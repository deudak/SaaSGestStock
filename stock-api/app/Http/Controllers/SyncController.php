<?php

namespace App\Http\Controllers;

use App\Models\CashSession;
use App\Models\Category;
use App\Models\Installment;
use App\Models\InstallmentPayment;
use App\Models\JournalEntry;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\Sale;
use App\Models\StockMovement;
use App\Models\User;
use App\Support\ClientFormat;
use App\Support\Tenant;
use App\Sync\Records;
use App\Sync\SyncRejected;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Synchronisation de toutes les données métier entre les appareils d'une entreprise.
 *
 * Le front applique ses modifications localement (hors ligne compris) et envoie une file
 * d'opérations { opId, entity, action: upsert|delete, id, data }. En retour il reçoit
 * les changements de tous les appareils depuis son curseur (journal sync_log).
 *
 * Règles qui évitent les pertes quand plusieurs appareils travaillent en même temps :
 * - le stock n'est jamais écrasé : seuls les mouvements (+/-) sont appliqués, le serveur fait le total ;
 *   un stock négatif signale une survente (« conflicts ») ;
 * - les versements sont des lignes séparées et le montant payé d'une vente à crédit est recalculé ;
 * - mouvements et ventes sont idempotents : renvoyer une opération déjà reçue n'a pas d'effet.
 */
class SyncController extends Controller
{
    /** Au-delà, l'appareil recharge tout (GET /bootstrap) plutôt que de rejouer le journal */
    private const MAX_CHANGES = 3000;

    /** Droits des rôles non administrateurs : entité => actions */
    private const PERMISSIONS = [
        'seller' => ['cashSession' => ['upsert'], 'sale' => ['upsert'], 'customer' => ['upsert', 'delete'], 'installment' => ['upsert'], 'payment' => ['upsert'], 'movement' => ['upsert'], 'task' => ['upsert']],
        'technician' => ['task' => ['upsert'], 'history' => ['upsert'], 'sheet' => ['upsert']],
        // Comptable : saisies comptables uniquement (ni ventes, ni stock, ni prix)
        'accountant' => ['expense' => ['upsert', 'delete'], 'supplierPayment' => ['upsert', 'delete'], 'journalEntry' => ['upsert', 'delete']],
    ];

    /** Champs modifiables par entité (camelCase, format du front) */
    private const FIELDS = [
        'product' => ['sku', 'barcode', 'name', 'category', 'supplierId', 'price', 'minPrice', 'cost', 'alertThreshold', 'image', 'description'],
        'supplier' => ['name', 'contact', 'phone', 'email', 'category', 'address', 'status', 'rating', 'delay', 'notes'],
        'customer' => ['name', 'phone', 'email', 'city', 'notes'],
        'installment' => ['saleId', 'customerId', 'customerName', 'label', 'total', 'dueDate', 'sellerId', 'notes', 'cancelled'],
        'task' => ['product', 'task', 'date', 'status', 'assignedTo', 'technicianId', 'costEstimate', 'source', 'reportedBy'],
        'history' => ['product', 'action', 'technician', 'technicianId', 'date', 'cost', 'note'],
        'sheet' => ['product', 'model', 'info', 'originalValue', 'purchaseDate'],
        'expense' => ['date', 'account', 'label', 'amount', 'vat', 'method', 'supplierId', 'reference', 'note', 'maintenanceHistoryId'],
        'supplierPayment' => ['date', 'supplierId', 'purchaseOrderId', 'amount', 'method', 'note'],
    ];

    /** Compte du plan SYSCOHADA (classe 1 à 8) */
    private const ACCOUNT_RULE = ['required', 'string', 'regex:/^[1-8][0-9]{1,7}$/'];

    private const JOURNALS = ['AN', 'VE', 'AC', 'TR', 'OD'];

    private const DATES = ['date', 'dueDate', 'purchaseDate', 'expectedAt', 'receivedAt', 'cancelledAt', 'openedAt', 'closedAt'];

    /** Colonnes NOT NULL avec valeur par défaut : un null reçu est ignoré */
    private const NOT_NULL = ['price', 'min_price', 'cost', 'alert_threshold', 'rating', 'delay', 'status', 'cost_estimate', 'original_value', 'source', 'cancelled', 'vat', 'opening_float'];

    public const TASK_STATUSES = ['Signalé', 'Planifié', 'En cours', 'À remplacer', 'Terminé'];

    private User $user;

    /** Produits dont le stock a bougé pendant cette synchronisation */
    private array $touchedProducts = [];

    public function sync(Request $request): JsonResponse
    {
        $request->validate([
            'cursor' => ['nullable', 'integer', 'min:0'],
            'ops' => ['present', 'array', 'max:500'],
            'ops.*.opId' => ['required', 'string', 'max:60'],
            'ops.*.entity' => ['required', Rule::in([...array_keys(Records::ENTITIES), 'payment'])],
            'ops.*.action' => ['required', Rule::in(['upsert', 'delete'])],
            'ops.*.id' => ['required', 'string', 'max:100'],
            'ops.*.data' => ['nullable', 'array'],
        ]);

        $this->user = $request->user();
        $rejected = [];

        foreach ($request->input('ops') as $op) {
            try {
                DB::transaction(fn () => $this->apply($op));
            } catch (SyncRejected $e) {
                $rejected[] = ['opId' => $op['opId'], 'entity' => $op['entity'], 'id' => $op['id'], 'error' => $e->getMessage()];
            } catch (QueryException $e) {
                report($e);
                $rejected[] = ['opId' => $op['opId'], 'entity' => $op['entity'], 'id' => $op['id'], 'error' => 'Enregistrement impossible.'];
            }
        }

        $conflicts = Product::whereIn('id', array_unique($this->touchedProducts))->where('stock', '<', 0)->get(['id', 'name', 'stock'])
            ->map(fn (Product $p) => ['productId' => $p->id, 'name' => $p->name, 'stock' => $p->stock])->values();

        $result = $this->changesSince($request->input('cursor'));
        if (! $result['reset'] && $rejected) {
            $result['changes'] = [...$result['changes'], ...$this->repairs($request->input('ops'), $rejected)];
        }

        return response()->json(['rejected' => $rejected, 'conflicts' => $conflicts, ...$result]);
    }

    /**
     * État réel (côté serveur) des données dont la modification a été refusée,
     * pour que l'appareil annule sa version locale.
     */
    private function repairs(array $ops, array $rejected): array
    {
        $refused = collect($rejected)->pluck('opId')->flip();
        $targets = [];
        foreach ($ops as $op) {
            if (! isset($refused[$op['opId']])) {
                continue;
            }
            [$entity, $id] = match ($op['entity']) {
                'payment' => ['installment', $op['data']['installmentId'] ?? null],
                'movement' => ['product', $op['data']['productId'] ?? null],
                default => [$op['entity'], $op['id']],
            };
            if ($id && is_string($id) && in_array($entity, Records::visibleTo($this->user->role), true)) {
                $targets[$entity][$id] = true;
            }
        }

        $changes = [];
        foreach ($targets as $entity => $ids) {
            $found = Records::find($entity, array_keys($ids));
            foreach (array_keys($ids) as $id) {
                $changes[] = isset($found[$id])
                    ? ['entity' => $entity, 'id' => (string) $id, 'action' => 'upsert', 'data' => $found[$id]]
                    : ['entity' => $entity, 'id' => (string) $id, 'action' => 'delete'];
            }
        }

        return $changes;
    }

    /** Dernier curseur du journal de l'entreprise (lu avant les données lors d'un bootstrap). */
    public static function currentCursor(): int
    {
        return (int) DB::table('sync_log')->where('company_id', Tenant::id())->max('id');
    }

    public static function log(string $entity, string $id, string $action = 'upsert'): void
    {
        DB::table('sync_log')->insert(['company_id' => Tenant::id(), 'entity' => $entity, 'record_id' => $id, 'action' => $action, 'created_at' => now()]);
    }

    // ------------------------------------------------------------------ application des opérations

    private function apply(array $op): void
    {
        [$entity, $action, $id, $data] = [$op['entity'], $op['action'], $op['id'], $op['data'] ?? []];

        if ($entity !== 'category' && ! preg_match('/^[A-Za-z0-9_-]{1,40}$/', $id)) {
            throw new SyncRejected('Identifiant invalide.');
        }
        if (! $this->user->isAdmin() && ! in_array($action, self::PERMISSIONS[$this->user->role][$entity] ?? [], true)) {
            throw new SyncRejected('Action non autorisée pour votre rôle.');
        }

        match (true) {
            $entity === 'movement' => $this->applyMovement($id, $data),
            $entity === 'payment' => $action === 'delete' ? $this->deletePayment($id) : $this->upsertPayment($id, $data),
            $entity === 'category' => $this->applyCategory($action, $id),
            $action === 'delete' => $this->delete($entity, $id),
            $entity === 'sale' => $this->upsertSale($id, $data),
            $entity === 'purchaseOrder' => $this->upsertPurchaseOrder($id, $data),
            $entity === 'task' => $this->upsertTask($id, $data),
            $entity === 'installment' => $this->upsertInstallment($id, $data),
            $entity === 'journalEntry' => $this->upsertJournalEntry($id, $data),
            $entity === 'cashSession' => $this->upsertCashSession($id, $data),
            default => $this->upsert($entity, $id, $data),
        };
    }

    /** Upsert générique : validation, conversion camelCase -> colonnes, journal. */
    private function upsert(string $entity, string $id, array $data, array $forced = []): Model
    {
        $columns = $this->validated($data, $this->rules($entity), self::FIELDS[$entity]);
        $class = Records::ENTITIES[$entity][0];

        $model = $class::find($id) ?? new $class();
        $model->fill([...$columns, ...$forced]);
        $model->{$model->getKeyName()} = $id;
        $model->save();

        self::log($entity, $id);

        return $model;
    }

    private function delete(string $entity, string $id): void
    {
        Records::ENTITIES[$entity][0]::find($id)?->delete();
        self::log($entity, $id, 'delete');
    }

    private function applyCategory(string $action, string $name): void
    {
        $name = trim($name);
        if ($name === '' || mb_strlen($name) > 100) {
            throw new SyncRejected('Nom de catégorie invalide.');
        }
        if ($action === 'delete') {
            Category::find($name)?->delete();
        } elseif (! Category::find($name)) {
            Category::create(['name' => $name, 'position' => (int) Category::max('position') + 1]);
        }
        self::log('category', $name, $action);
    }

    /** Mouvement de stock : appliqué une seule fois, en delta sur le stock du serveur. */
    private function applyMovement(string $id, array $data): void
    {
        if (StockMovement::find($id)) {
            return; // déjà reçu (renvoi après une coupure)
        }

        $columns = $this->validated($data, [
            'productId' => ['nullable', 'string', 'max:40'],
            'productName' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::in(['in', 'out'])],
            'qty' => ['required', 'integer', 'min:0'],
            'reason' => ['required', 'string', 'max:255'],
            'reference' => ['nullable', 'string', 'max:60'],
            'date' => ['required', 'date'],
            'userName' => ['nullable', 'string', 'max:255'],
        ], ['productId', 'productName', 'type', 'qty', 'reason', 'reference', 'date', 'userName']);

        // Un vendeur ne bouge le stock qu'au travers de ses propres ventes (vente ou retour)
        if ($this->user->role === 'seller') {
            $sale = $columns['reference'] ? Sale::find($columns['reference']) : null;
            $saleReason = $columns['reason'] === 'Vente' || str_starts_with($columns['reason'], 'Retour');
            if (! $saleReason || ! $sale || $sale->seller_id !== $this->user->id) {
                throw new SyncRejected('Un vendeur ne peut modifier le stock que par ses ventes.');
            }
        }

        $movement = new StockMovement($columns);
        $movement->id = $id;
        $movement->save();
        self::log('movement', $id);

        $product = $columns['product_id'] ? Product::find($columns['product_id']) : null;
        if ($product && $columns['qty'] > 0) {
            $product->increment('stock', $columns['type'] === 'in' ? $columns['qty'] : -$columns['qty']);
            $this->touchedProducts[] = $product->id;
            self::log('product', $product->id);
        }
    }

    /** Vente : créée une fois avec ses lignes ; ensuite seule l'annulation peut changer. */
    private function upsertSale(string $id, array $data): void
    {
        $existing = Sale::find($id);

        if ($existing) {
            if ($this->user->role === 'seller' && $existing->seller_id !== $this->user->id) {
                throw new SyncRejected('Cette vente appartient à un autre vendeur.');
            }
            $columns = $this->validated($data, [
                'status' => ['required', Rule::in(['completed', 'cancelled'])],
                'cancelReason' => ['nullable', 'string', 'max:255'],
                'cancelledAt' => ['nullable', 'date'],
            ], ['status', 'cancelReason', 'cancelledAt']);
            $existing->fill($columns)->save();
            self::log('sale', $id);

            return;
        }

        $fields = ['date', 'sellerId', 'customerId', 'customerName', 'subtotal', 'discount', 'total', 'paid', 'method', 'mode', 'status', 'installmentId', 'cancelReason', 'cancelledAt'];
        $columns = $this->validated($data, [
            'date' => ['required', 'date'],
            'sellerId' => ['nullable', 'string', 'max:40'],
            'customerId' => ['nullable', 'string', 'max:40'],
            'customerName' => ['required', 'string', 'max:255'],
            'subtotal' => ['required', 'integer', 'min:0'],
            'discount' => ['nullable', 'integer', 'min:0'],
            'total' => ['required', 'integer', 'min:0'],
            'paid' => ['nullable', 'integer', 'min:0'],
            'method' => ['required', 'string', 'max:20'],
            'mode' => ['required', Rule::in(['cash', 'credit'])],
            'status' => ['required', Rule::in(['completed', 'cancelled'])],
            'installmentId' => ['nullable', 'string', 'max:40'],
            'cancelReason' => ['nullable', 'string', 'max:255'],
            'cancelledAt' => ['nullable', 'date'],
        ], $fields);
        $items = $this->validatedItems($data, ['productId' => ['nullable', 'string', 'max:40'], 'name' => ['required', 'string', 'max:255'], 'qty' => ['required', 'integer', 'min:1'], 'price' => ['required', 'integer', 'min:0'], 'cost' => ['nullable', 'integer', 'min:0']]);

        if ($this->user->role === 'seller') {
            $columns['seller_id'] = $this->user->id;
        }

        $sale = new Sale(array_filter($columns, fn ($v, $k) => ! ($v === null && in_array($k, ['discount', 'paid'], true)), ARRAY_FILTER_USE_BOTH));
        $sale->id = $id;
        $sale->save();
        foreach ($items as $item) {
            $sale->items()->create(['product_id' => $item['productId'] ?? null, 'name' => $item['name'], 'qty' => $item['qty'], 'price' => $item['price'], 'cost' => $item['cost'] ?? 0]);
        }
        self::log('sale', $id);
    }

    private function upsertPurchaseOrder(string $id, array $data): void
    {
        $columns = $this->validated($data, [
            'supplierId' => ['nullable', 'string', 'max:40'],
            'status' => ['required', Rule::in(['draft', 'sent', 'received', 'cancelled'])],
            'expectedAt' => ['nullable', 'date'],
            'receivedAt' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ], ['supplierId', 'status', 'expectedAt', 'receivedAt', 'notes']);
        $items = $this->validatedItems($data, ['productId' => ['nullable', 'string', 'max:40'], 'name' => ['required', 'string', 'max:255'], 'qty' => ['required', 'integer', 'min:1'], 'cost' => ['nullable', 'integer', 'min:0']]);

        $order = PurchaseOrder::find($id) ?? new PurchaseOrder();
        $order->fill($columns);
        $order->id = $id;
        $order->save();

        $order->items()->delete();
        foreach ($items as $item) {
            $order->items()->create(['product_id' => $item['productId'] ?? null, 'name' => $item['name'], 'qty' => $item['qty'], 'cost' => $item['cost'] ?? 0]);
        }
        self::log('purchaseOrder', $id);
    }

    private function upsertTask(string $id, array $data): void
    {
        // Vendeur : uniquement de nouveaux signalements, à son nom
        if ($this->user->role === 'seller') {
            if (Records::ENTITIES['task'][0]::find($id)) {
                throw new SyncRejected('Un vendeur peut seulement signaler une panne.');
            }
            $data = [...$data, 'status' => 'Signalé', 'source' => 'seller', 'reportedBy' => $this->user->id, 'assignedTo' => '', 'technicianId' => null, 'costEstimate' => 0];
        }
        $this->upsert('task', $id, $data);
    }

    private function upsertInstallment(string $id, array $data): void
    {
        $existing = Installment::find($id);
        $forced = [];
        if ($this->user->role === 'seller') {
            if ($existing && $existing->seller_id && $existing->seller_id !== $this->user->id) {
                throw new SyncRejected('Ce dossier de paiement appartient à un autre vendeur.');
            }
            if (! $existing) {
                $forced['seller_id'] = $this->user->id;
            }
        }
        $this->upsert('installment', $id, $data, $forced);
    }

    /** Écriture manuelle : au moins deux lignes, chacune au débit OU au crédit, total débit = total crédit. */
    private function upsertJournalEntry(string $id, array $data): void
    {
        $columns = $this->validated($data, [
            'date' => ['required', 'date'],
            'journal' => ['required', Rule::in(self::JOURNALS)],
            'label' => ['required', 'string', 'max:255'],
            'reference' => ['nullable', 'string', 'max:60'],
            'lines' => ['required', 'array', 'min:2', 'max:50'],
            'lines.*.account' => self::ACCOUNT_RULE,
            'lines.*.label' => ['nullable', 'string', 'max:255'],
            'lines.*.debit' => ['required', 'integer', 'min:0'],
            'lines.*.credit' => ['required', 'integer', 'min:0'],
        ], ['date', 'journal', 'label', 'reference', 'lines']);

        $lines = array_map(fn ($line) => [
            'account' => $line['account'],
            'label' => $line['label'] ?? '',
            'debit' => (int) $line['debit'],
            'credit' => (int) $line['credit'],
        ], $columns['lines']);

        foreach ($lines as $line) {
            if (($line['debit'] > 0) === ($line['credit'] > 0)) {
                throw new SyncRejected('Chaque ligne doit avoir un montant au débit ou au crédit (pas les deux).');
            }
        }
        $debit = array_sum(array_column($lines, 'debit'));
        if ($debit !== array_sum(array_column($lines, 'credit'))) {
            throw new SyncRejected('Écriture déséquilibrée : le total des débits doit égaler le total des crédits.');
        }

        $entry = JournalEntry::find($id) ?? new JournalEntry();
        $entry->fill([...$columns, 'lines' => $lines]);
        $entry->id = $id;
        $entry->save();
        self::log('journalEntry', $id);
    }

    /**
     * Session de caisse d'un vendeur : ouverture (fond de caisse), mouvements, clôture (comptage, écart).
     * Un vendeur ne gère que sa caisse, une seule ouverte à la fois, et ne modifie plus une caisse clôturée.
     */
    private function upsertCashSession(string $id, array $data): void
    {
        $existing = CashSession::find($id);
        $isSeller = $this->user->role === 'seller';
        if ($isSeller && $existing && ($existing->seller_id !== $this->user->id || $existing->status === 'closed')) {
            throw new SyncRejected('Cette caisse ne peut plus être modifiée.');
        }

        $columns = $this->validated($data, [
            'sellerId' => [$isSeller ? 'nullable' : 'required', 'string', 'max:40'],
            'status' => ['required', Rule::in(['open', 'closed'])],
            'openedAt' => ['required', 'date'],
            'closedAt' => ['nullable', 'date', 'required_if:status,closed'],
            'openingFloat' => ['nullable', 'integer', 'min:0'],
            'movements' => ['nullable', 'array', 'max:300'],
            'movements.*.id' => ['required', 'string', 'max:40'],
            'movements.*.type' => ['required', Rule::in(['deposit', 'expense', 'in'])],
            'movements.*.amount' => ['required', 'integer', 'min:1'],
            'movements.*.reason' => ['nullable', 'string', 'max:255'],
            'movements.*.at' => ['required', 'date'],
            'expectedCash' => ['nullable', 'integer', 'min:0'],
            'countedCash' => ['nullable', 'integer', 'min:0'],
            'difference' => ['nullable', 'integer'],
            'denominations' => ['nullable', 'array', 'max:20'],
            'note' => ['nullable', 'string', 'max:2000'],
        ], ['sellerId', 'status', 'openedAt', 'closedAt', 'openingFloat', 'movements', 'expectedCash', 'countedCash', 'difference', 'denominations', 'note']);

        if ($isSeller) {
            $columns['seller_id'] = $this->user->id;
        }
        $sellerId = $columns['seller_id'] ?? $existing?->seller_id;
        if ($columns['status'] === 'open' && CashSession::where('seller_id', $sellerId)->where('status', 'open')->where('id', '!=', $id)->exists()) {
            throw new SyncRejected("Une caisse est déjà ouverte pour ce vendeur : clôturez-la d'abord.");
        }

        $session = $existing ?? new CashSession();
        $session->fill($columns);
        $session->id = $id;
        $session->save();
        self::log('cashSession', $id);
    }

    private function upsertPayment(string $id, array $data): void
    {
        $columns = $this->validated($data, [
            'installmentId' => ['required', 'string', 'max:40'],
            'date' => ['required', 'date'],
            'amount' => ['required', 'integer', 'min:0'],
            'method' => ['required', 'string', 'max:20'],
            'note' => ['nullable', 'string', 'max:255'],
            'receivedBy' => ['nullable', 'string', 'max:40'],
        ], ['installmentId', 'date', 'amount', 'method', 'note', 'receivedBy']);
        if ($this->user->role === 'seller') {
            $columns['received_by'] = $this->user->id;
        }

        $installment = Installment::find($columns['installment_id']);
        if (! $installment) {
            throw new SyncRejected('Dossier de paiement introuvable.');
        }

        $payment = InstallmentPayment::find($id) ?? new InstallmentPayment();
        $payment->fill($columns);
        $payment->id = $id;
        $payment->save();

        $this->refreshInstallment($installment);
    }

    private function deletePayment(string $id): void
    {
        $payment = InstallmentPayment::find($id);
        if (! $payment) {
            return;
        }
        $installment = Installment::find($payment->installment_id);
        $payment->delete();
        if ($installment) {
            $this->refreshInstallment($installment);
        }
    }

    /** Montant payé d'une vente à crédit = somme des versements de son dossier. */
    private function refreshInstallment(Installment $installment): void
    {
        self::log('installment', $installment->id);

        $sale = $installment->sale_id ? Sale::find($installment->sale_id) : null;
        if ($sale && $sale->mode === 'credit') {
            $sale->paid = (int) InstallmentPayment::where('installment_id', $installment->id)->sum('amount');
            $sale->save();
            self::log('sale', $sale->id);
        }
    }

    // ------------------------------------------------------------------ validation

    /** Valide puis convertit en colonnes SQL (dates parsées, null ignorés sur colonnes NOT NULL). */
    private function validated(array $data, array $rules, array $fields): array
    {
        $validator = Validator::make($data, $rules);
        if ($validator->fails()) {
            throw new SyncRejected($validator->errors()->first());
        }

        $columns = [];
        foreach (ClientFormat::toColumns($validator->validated(), $fields) as $column => $value) {
            if ($value === null && in_array($column, self::NOT_NULL, true)) {
                continue;
            }
            $columns[$column] = $value !== null && in_array(Str::camel($column), self::DATES, true) ? Carbon::parse($value) : $value;
        }

        return $columns;
    }

    private function validatedItems(array $data, array $rules): array
    {
        $validator = Validator::make($data, ['items' => ['required', 'array', 'min:1', 'max:200'], ...collect($rules)->mapWithKeys(fn ($r, $k) => ["items.*.$k" => $r])->all()]);
        if ($validator->fails()) {
            throw new SyncRejected($validator->errors()->first());
        }

        return $validator->validated()['items'];
    }

    private function rules(string $entity): array
    {
        // Un compte lié (maintenancier) doit appartenir à la même entreprise
        $member = Rule::exists('users', 'id')->where('company_id', $this->user->company_id);

        return match ($entity) {
            'product' => [
                'name' => ['required', 'string', 'max:255'],
                'sku' => ['nullable', 'string', 'max:60'],
                'barcode' => ['nullable', 'string', 'max:64'],
                'category' => ['nullable', 'string', 'max:100'],
                'supplierId' => ['nullable', 'string', 'max:40'],
                'price' => ['nullable', 'integer', 'min:0'],
                'minPrice' => ['nullable', 'integer', 'min:0'],
                'cost' => ['nullable', 'integer', 'min:0'],
                'alertThreshold' => ['nullable', 'integer', 'min:0'],
                'image' => ['nullable', 'string', 'max:3000000'],
                'description' => ['nullable', 'string', 'max:5000'],
            ],
            'supplier' => [
                'name' => ['required', 'string', 'max:255'],
                'contact' => ['nullable', 'string', 'max:255'],
                'phone' => ['nullable', 'string', 'max:255'],
                'email' => ['nullable', 'string', 'max:255'],
                'category' => ['nullable', 'string', 'max:255'],
                'address' => ['nullable', 'string', 'max:255'],
                'status' => ['nullable', 'string', 'max:30'],
                'rating' => ['nullable', 'integer', 'min:0', 'max:5'],
                'delay' => ['nullable', 'integer', 'min:0'],
                'notes' => ['nullable', 'string', 'max:5000'],
            ],
            'customer' => [
                'name' => ['required', 'string', 'max:255'],
                'phone' => ['nullable', 'string', 'max:255'],
                'email' => ['nullable', 'string', 'max:255'],
                'city' => ['nullable', 'string', 'max:255'],
                'notes' => ['nullable', 'string', 'max:5000'],
            ],
            'installment' => [
                'saleId' => ['nullable', 'string', 'max:40'],
                'customerId' => ['nullable', 'string', 'max:40'],
                'customerName' => ['required', 'string', 'max:255'],
                'label' => ['required', 'string', 'max:500'],
                'total' => ['required', 'integer', 'min:0'],
                'dueDate' => ['required', 'date'],
                'sellerId' => ['nullable', 'string', 'max:40'],
                'notes' => ['nullable', 'string', 'max:5000'],
                'cancelled' => ['nullable', 'boolean'],
            ],
            'task' => [
                'product' => ['required', 'string', 'max:255'],
                'task' => ['required', 'string', 'max:2000'],
                'date' => ['required', 'date'],
                'status' => ['required', Rule::in(self::TASK_STATUSES)],
                'assignedTo' => ['nullable', 'string', 'max:255'],
                'technicianId' => ['nullable', 'string', $member],
                'costEstimate' => ['nullable', 'integer', 'min:0'],
                'source' => ['nullable', Rule::in(['admin', 'seller'])],
                'reportedBy' => ['nullable', 'string', 'max:40'],
            ],
            'history' => [
                'product' => ['required', 'string', 'max:255'],
                'action' => ['required', 'string', 'max:255'],
                'technician' => ['nullable', 'string', 'max:255'],
                'technicianId' => ['nullable', 'string', $member],
                'date' => ['required', 'date'],
                'cost' => ['nullable', 'integer', 'min:0'],
                'note' => ['nullable', 'string', 'max:2000'],
            ],
            'sheet' => [
                'product' => ['required', 'string', 'max:255'],
                'model' => ['nullable', 'string', 'max:255'],
                'info' => ['nullable', 'string', 'max:5000'],
                'originalValue' => ['nullable', 'integer', 'min:0'],
                'purchaseDate' => ['nullable', 'date'],
            ],
            'expense' => [
                'date' => ['required', 'date'],
                'account' => self::ACCOUNT_RULE,
                'label' => ['required', 'string', 'max:255'],
                'amount' => ['required', 'integer', 'min:1'],
                'vat' => ['nullable', 'integer', 'min:0', 'lte:amount'],
                'method' => ['required', Rule::in(['cash', 'mobile', 'card', 'transfer', 'unpaid'])],
                'supplierId' => ['nullable', 'string', 'max:40'],
                'reference' => ['nullable', 'string', 'max:60'],
                'note' => ['nullable', 'string', 'max:2000'],
                'maintenanceHistoryId' => ['nullable', 'string', 'max:40'],
            ],
            'supplierPayment' => [
                'date' => ['required', 'date'],
                'supplierId' => ['nullable', 'string', 'max:40'],
                'purchaseOrderId' => ['nullable', 'string', 'max:40'],
                'amount' => ['required', 'integer', 'min:1'],
                'method' => ['required', Rule::in(['cash', 'mobile', 'card', 'transfer'])],
                'note' => ['nullable', 'string', 'max:2000'],
            ],
        };
    }

    // ------------------------------------------------------------------ changements à renvoyer

    /** Changements depuis le curseur de l'appareil, réduits au dernier état de chaque donnée. */
    private function changesSince(?int $cursor): array
    {
        $current = self::currentCursor();
        if ($cursor === null || $current - $cursor > self::MAX_CHANGES) {
            return ['changes' => [], 'cursor' => $current, 'reset' => true];
        }

        $visible = Records::visibleTo($this->user->role);
        $latest = [];
        DB::table('sync_log')->where('company_id', Tenant::id())->where('id', '>', $cursor)->where('id', '<=', $current)->orderBy('id')
            ->get()
            ->each(function ($row) use ($visible, &$latest) {
                if (in_array($row->entity, $visible, true)) {
                    unset($latest["$row->entity|$row->record_id"]); // garde l'ordre du dernier changement
                    $latest["$row->entity|$row->record_id"] = $row;
                }
            });

        $records = [];
        foreach (collect($latest)->where('action', 'upsert')->groupBy('entity') as $entity => $rows) {
            $records[$entity] = Records::find($entity, $rows->pluck('record_id')->all());
        }

        $changes = [];
        foreach ($latest as $row) {
            $data = $records[$row->entity][$row->record_id] ?? null;
            $changes[] = $row->action === 'upsert' && $data !== null
                ? ['entity' => $row->entity, 'id' => $row->record_id, 'action' => 'upsert', 'data' => $data]
                : ['entity' => $row->entity, 'id' => $row->record_id, 'action' => 'delete'];
        }

        return ['changes' => $changes, 'cursor' => $current, 'reset' => false];
    }
}
