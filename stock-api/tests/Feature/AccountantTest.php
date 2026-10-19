<?php

namespace Tests\Feature;

use App\Models\Sale;
use App\Models\User;
use App\Support\Tenant;
use Laravel\Sanctum\Sanctum;

/** Le comptable tient la comptabilité de son entreprise, sans toucher aux ventes, au stock ni aux comptes. */
class AccountantTest extends SyncTestCase
{
    private User $accountant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->accountant = $this->member('accountant');
    }

    public function test_admin_can_create_an_accountant(): void
    {
        Sanctum::actingAs($this->admin);
        $this->postJson('/api/users', ['name' => 'Aïcha', 'email' => 'aicha@compta.test', 'password' => 'secret1', 'role' => 'accountant'])
            ->assertCreated()
            ->assertJsonPath('role', 'accountant');
    }

    public function test_accountant_reads_everything_that_produces_entries(): void
    {
        Tenant::run($this->admin->company_id, fn () => Sale::create(['id' => 'V-00001', 'date' => now(), 'customer_name' => 'Client', 'total' => 1000]));

        Sanctum::actingAs($this->accountant);
        $this->getJson('/api/bootstrap')
            ->assertOk()
            ->assertJsonCount(1, 'sales')
            ->assertJsonStructure(['products', 'purchaseOrders', 'installments', 'stockMovements', 'maintenanceHistory', 'expenses', 'supplierPayments', 'journalEntries']);
    }

    public function test_accountant_writes_accounting_entries(): void
    {
        Sanctum::actingAs($this->accountant);
        $this->sync([
            ['entity' => 'expense', 'id' => 'ex_1', 'data' => ['date' => '2026-10-20T08:00:00.000Z', 'account' => '6222', 'label' => 'Loyer', 'amount' => 150000, 'method' => 'transfer']],
            ['entity' => 'supplierPayment', 'id' => 'sp_1', 'data' => ['date' => '2026-10-20T08:00:00.000Z', 'supplierId' => 's_1', 'amount' => 5000, 'method' => 'cash']],
            ['entity' => 'journalEntry', 'id' => 'je_1', 'data' => ['date' => '2026-10-01T00:00:00.000Z', 'journal' => 'OD', 'label' => 'Apport', 'lines' => [['account' => '521', 'debit' => 1000, 'credit' => 0], ['account' => '101', 'debit' => 0, 'credit' => 1000]]]],
        ])->assertJsonPath('rejected', []);

        $this->sync([['entity' => 'expense', 'action' => 'delete', 'id' => 'ex_1']])->assertJsonPath('rejected', []);
    }

    public function test_accountant_cannot_touch_sales_stock_or_maintenance(): void
    {
        Sanctum::actingAs($this->accountant);
        $response = $this->sync([
            ['entity' => 'product', 'id' => 'p_1', 'data' => $this->product()],
            ['entity' => 'sale', 'id' => 'V-X-0001', 'data' => $this->sale($this->accountant->id)],
            ['entity' => 'movement', 'id' => 'mv_1', 'data' => $this->movement('p_1', 'in', 5)],
            ['entity' => 'customer', 'id' => 'c_1', 'data' => ['name' => 'Awa']],
            ['entity' => 'task', 'id' => 'mt_1', 'data' => ['product' => 'Caisse', 'task' => 'Panne', 'date' => '2026-10-20T08:00:00.000Z', 'status' => 'Planifié']],
        ]);

        $response->assertJsonCount(5, 'rejected');
    }

    public function test_accountant_sets_opening_balances_but_not_company_identity_or_team(): void
    {
        Sanctum::actingAs($this->accountant);
        $this->putJson('/api/company/accounting', ['settings' => ['accountingStart' => '2026-01-01', 'openingCash' => 120000, 'brandColor' => '#000000']])
            ->assertOk()
            ->assertJsonPath('settings.accountingStart', '2026-01-01')
            ->assertJsonPath('settings.openingCash', 120000)
            ->assertJsonPath('settings.brandColor', '#2554eb'); // ignoré : hors comptabilité

        $this->putJson('/api/company', ['name' => 'Piratée'])->assertForbidden();
        $this->postJson('/api/users', ['name' => 'X', 'email' => 'x@compta.test', 'password' => 'secret1'])->assertForbidden();
    }

    public function test_sellers_cannot_change_accounting_settings(): void
    {
        Sanctum::actingAs($this->member('seller'));
        $this->putJson('/api/company/accounting', ['settings' => ['openingCash' => 1]])->assertForbidden();
    }
}
