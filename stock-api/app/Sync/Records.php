<?php

namespace App\Sync;

use App\Models\Category;
use App\Models\Customer;
use App\Models\Installment;
use App\Models\MaintenanceHistory;
use App\Models\MaintenanceTask;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\Sale;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\TechSheet;
use App\Support\ClientFormat;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;

/**
 * Lecture des données synchronisées, au format du store du front.
 * Les requêtes passent par les modèles filtrés par entreprise (BelongsToCompany).
 */
class Records
{
    /** Entité => [modèle, clé du store front] */
    public const ENTITIES = [
        'product' => [Product::class, 'products'],
        'category' => [Category::class, 'categories'],
        'supplier' => [Supplier::class, 'suppliers'],
        'customer' => [Customer::class, 'customers'],
        'sale' => [Sale::class, 'sales'],
        'installment' => [Installment::class, 'installments'],
        'purchaseOrder' => [PurchaseOrder::class, 'purchaseOrders'],
        'movement' => [StockMovement::class, 'stockMovements'],
        'task' => [MaintenanceTask::class, 'maintenanceTasks'],
        'history' => [MaintenanceHistory::class, 'maintenanceHistory'],
        'sheet' => [TechSheet::class, 'techSheets'],
    ];

    /** Seule la maintenance est visible du maintenancier */
    public const MAINTENANCE = ['task', 'history', 'sheet'];

    public static function visibleTo(string $role): array
    {
        return $role === 'technician' ? self::MAINTENANCE : array_keys(self::ENTITIES);
    }

    public static function query(string $entity): Builder
    {
        $query = self::ENTITIES[$entity][0]::query();

        return match ($entity) {
            'sale', 'purchaseOrder' => $query->with('items'),
            'installment' => $query->with('payments'),
            default => $query,
        };
    }

    /** Toutes les lignes d'une entité, dans l'ordre d'affichage du front. */
    public static function all(string $entity): array
    {
        $query = self::query($entity);
        $query = match ($entity) {
            'category' => $query->orderBy('position'),
            'supplier', 'sheet' => $query->orderBy($entity === 'supplier' ? 'name' : 'product'),
            'sale', 'movement', 'history' => $query->orderByDesc('date'),
            'task' => $query->orderBy('date'),
            default => $query->orderByDesc('created_at'),
        };

        return $query->get()->map(fn (Model $model) => self::format($entity, $model))->values()->all();
    }

    /** Lignes d'une entité par identifiants, indexées par identifiant. */
    public static function find(string $entity, array $ids): Collection
    {
        $model = self::ENTITIES[$entity][0];
        $key = (new $model())->getKeyName();

        return self::query($entity)->whereIn($key, $ids)->get()->keyBy($key)->map(fn (Model $m) => self::format($entity, $m));
    }

    /** Une catégorie est une simple chaîne côté front. */
    public static function format(string $entity, Model $model): array|string
    {
        return match ($entity) {
            'category' => $model->name,
            'supplier' => ClientFormat::row($model, ['created_at']),
            'sale' => [
                ...ClientFormat::row($model, ['created_at', 'items']),
                'items' => $model->items->map(fn ($item) => Arr::only(ClientFormat::row($item), ['productId', 'name', 'qty', 'price', 'cost']))->values()->all(),
            ],
            'installment' => [
                ...ClientFormat::row($model, ['payments']),
                'payments' => $model->payments->sortBy('date')->map(fn ($payment) => ClientFormat::row($payment, ['installment_id']))->values()->all(),
            ],
            'purchaseOrder' => [
                ...ClientFormat::row($model, ['items']),
                'items' => $model->items->map(fn ($item) => Arr::only(ClientFormat::row($item), ['productId', 'name', 'qty', 'cost']))->values()->all(),
            ],
            default => ClientFormat::row($model),
        };
    }
}
