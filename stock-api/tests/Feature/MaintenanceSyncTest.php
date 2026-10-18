<?php

namespace Tests\Feature;

use App\Models\MaintenanceTask;
use App\Models\Sale;
use App\Models\User;
use App\Support\Tenant;
use Laravel\Sanctum\Sanctum;

/** Maintenance partagée entre admin, vendeurs et maintenanciers d'une même entreprise. */
class MaintenanceSyncTest extends SyncTestCase
{
    private User $technician;

    private User $seller;

    protected function setUp(): void
    {
        parent::setUp();
        $this->technician = $this->member('technician', ['name' => 'Lucas Tech']);
        $this->seller = $this->member('seller');
    }

    private function task(array $overrides = []): array
    {
        return ['product' => 'Imprimante de caisse', 'task' => 'Bourrage papier', 'date' => '2026-10-20T08:00:00.000Z', 'status' => 'Planifié', 'assignedTo' => '', 'costEstimate' => 5000, ...$overrides];
    }

    public function test_admin_can_create_a_technician_account(): void
    {
        Sanctum::actingAs($this->admin);
        $this->postJson('/api/users', ['name' => 'Nadia', 'email' => 'nadia@tech.test', 'password' => 'secret1', 'role' => 'technician'])
            ->assertCreated()
            ->assertJsonPath('role', 'technician');
    }

    public function test_technician_only_gets_maintenance(): void
    {
        Tenant::run($this->admin->company_id, fn () => Sale::create(['id' => 'V-00001', 'date' => now(), 'customer_name' => 'Client', 'total' => 1000]));

        Sanctum::actingAs($this->technician);
        $this->getJson('/api/bootstrap')
            ->assertOk()
            ->assertJsonStructure(['cursor', 'users', 'maintenanceTasks', 'maintenanceHistory', 'techSheets'])
            ->assertJsonMissingPath('sales')
            ->assertJsonMissingPath('products')
            ->assertJsonMissingPath('customers');

        // Même chose pour les changements reçus en synchronisation
        Sanctum::actingAs($this->admin);
        $this->sync([['entity' => 'customer', 'id' => 'c_1', 'data' => ['name' => 'Awa']], ['entity' => 'task', 'id' => 'mt_1', 'data' => $this->task()]]);
        Sanctum::actingAs($this->technician);
        $this->assertSame(['task'], collect($this->sync([])->json('changes'))->pluck('entity')->all());
    }

    public function test_intervention_flows_from_admin_to_technician_and_back(): void
    {
        Sanctum::actingAs($this->admin);
        $this->sync([['entity' => 'task', 'id' => 'mt_1', 'data' => $this->task(['assignedTo' => 'Lucas Tech', 'technicianId' => $this->technician->id])]])
            ->assertJsonPath('rejected', []);

        Sanctum::actingAs($this->technician);
        $this->assertSame($this->technician->id, $this->change($this->sync([]), 'task', 'mt_1')['data']['technicianId']);

        $this->sync([
            ['entity' => 'task', 'id' => 'mt_1', 'data' => $this->task(['status' => 'Terminé', 'assignedTo' => 'Lucas Tech', 'technicianId' => $this->technician->id])],
            ['entity' => 'history', 'id' => 'mh_1', 'data' => ['product' => 'Imprimante de caisse', 'action' => 'Bourrage papier', 'technician' => 'Lucas Tech', 'technicianId' => $this->technician->id, 'date' => '2026-10-20T10:00:00.000Z', 'cost' => 4000, 'note' => 'Rouleau changé']],
        ])->assertJsonPath('rejected', []);

        Sanctum::actingAs($this->admin);
        $response = $this->sync([]);
        $this->assertSame('Terminé', $this->change($response, 'task', 'mt_1')['data']['status']);
        $this->assertSame('Rouleau changé', $this->change($response, 'history', 'mh_1')['data']['note']);
    }

    public function test_only_the_admin_can_delete(): void
    {
        Tenant::run($this->admin->company_id, fn () => MaintenanceTask::create(['id' => 'mt_1', ...$this->task(), 'date' => now()]));

        Sanctum::actingAs($this->technician);
        $this->sync([['entity' => 'task', 'action' => 'delete', 'id' => 'mt_1']])->assertJsonCount(1, 'rejected');

        Sanctum::actingAs($this->admin);
        $response = $this->sync([['entity' => 'task', 'action' => 'delete', 'id' => 'mt_1']])->assertJsonPath('rejected', []);
        $this->assertSame('delete', $this->change($response, 'task', 'mt_1')['action']);
    }

    public function test_seller_can_only_report_new_breakdowns(): void
    {
        Tenant::run($this->admin->company_id, fn () => MaintenanceTask::create(['id' => 'mt_1', ...$this->task(), 'date' => now()]));

        Sanctum::actingAs($this->seller);
        $response = $this->sync([
            ['entity' => 'task', 'id' => 'mt_2', 'data' => $this->task(['status' => 'Terminé', 'costEstimate' => 999999])],
            ['entity' => 'task', 'id' => 'mt_1', 'data' => $this->task(['status' => 'Terminé'])],
            ['entity' => 'sheet', 'id' => 'ts_1', 'data' => ['product' => 'Caisse']],
        ]);

        $response->assertJsonCount(2, 'rejected');
        $report = $this->change($response, 'task', 'mt_2')['data'];
        $this->assertSame('Signalé', $report['status']);
        $this->assertSame('seller', $report['source']);
        $this->assertSame($this->seller->id, $report['reportedBy']);
        $this->assertSame(0, $report['costEstimate']);
    }

    public function test_cannot_assign_a_technician_from_another_company(): void
    {
        $outsider = User::factory()->create(['role' => 'technician']);

        Sanctum::actingAs($this->admin);
        $this->sync([['entity' => 'task', 'id' => 'mt_1', 'data' => $this->task(['technicianId' => $outsider->id])]])
            ->assertJsonCount(1, 'rejected');
    }

    public function test_maintenance_stays_inside_each_company(): void
    {
        $otherAdmin = User::factory()->admin()->create();

        Sanctum::actingAs($this->admin);
        $this->sync([['entity' => 'task', 'id' => 'mt_1', 'data' => $this->task(['product' => 'Climatiseur A'])]]);

        Sanctum::actingAs($otherAdmin);
        $response = $this->sync([['entity' => 'task', 'id' => 'mt_1', 'data' => $this->task(['product' => 'Groupe électrogène B'])]]);
        $this->assertSame('Groupe électrogène B', $this->change($response, 'task', 'mt_1')['data']['product']);

        Sanctum::actingAs($this->technician);
        $this->assertSame('Climatiseur A', $this->change($this->sync([]), 'task', 'mt_1')['data']['product']);
    }
}
