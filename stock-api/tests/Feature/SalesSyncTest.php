<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Sale;
use App\Models\User;
use App\Support\Tenant;
use Laravel\Sanctum\Sanctum;

/** Ventes, stock et créances partagés entre plusieurs appareils d'une même entreprise. */
class SalesSyncTest extends SyncTestCase
{
    private function stock(string $id = 'p_1'): int
    {
        return Tenant::run($this->admin->company_id, fn () => Product::find($id)->stock);
    }

    private function createProductWithStock(int $qty): void
    {
        Sanctum::actingAs($this->admin);
        $this->sync([
            ['entity' => 'product', 'id' => 'p_1', 'data' => $this->product()],
            ['entity' => 'movement', 'id' => 'mv_init', 'data' => $this->movement('p_1', 'in', $qty)],
        ])->assertJsonPath('rejected', []);
    }

    public function test_stock_comes_from_movements_not_from_the_product_value(): void
    {
        $this->createProductWithStock(10);

        // La valeur « stock » envoyée avec le produit (999) est ignorée
        $this->assertSame(10, $this->stock());
    }

    public function test_two_offline_devices_selling_the_same_product_both_count(): void
    {
        $this->createProductWithStock(10);
        $jean = $this->member('seller');
        $marie = $this->member('seller');

        // Chaque appareil avait 10 en stock et en vend 2 : le serveur doit arriver à 6, pas 8
        Sanctum::actingAs($jean);
        $this->sync([
            ['entity' => 'sale', 'id' => 'V-AAA-0001', 'data' => $this->sale($jean->id)],
            ['entity' => 'movement', 'id' => 'mv_a1', 'data' => $this->movement('p_1', 'out', 2, ['reason' => 'Vente', 'reference' => 'V-AAA-0001'])],
        ])->assertJsonPath('rejected', []);

        Sanctum::actingAs($marie);
        $this->sync([
            ['entity' => 'sale', 'id' => 'V-BBB-0001', 'data' => $this->sale($marie->id)],
            ['entity' => 'movement', 'id' => 'mv_b1', 'data' => $this->movement('p_1', 'out', 2, ['reason' => 'Vente', 'reference' => 'V-BBB-0001'])],
        ])->assertJsonPath('rejected', []);

        $this->assertSame(6, $this->stock());
    }

    public function test_resending_the_same_operations_does_not_double_count(): void
    {
        $this->createProductWithStock(10);
        $seller = $this->member('seller');
        $ops = [
            ['entity' => 'sale', 'id' => 'V-AAA-0001', 'data' => $this->sale($seller->id)],
            ['entity' => 'movement', 'id' => 'mv_a1', 'data' => $this->movement('p_1', 'out', 2, ['reason' => 'Vente', 'reference' => 'V-AAA-0001'])],
        ];

        Sanctum::actingAs($seller);
        $this->sync($ops);
        $this->sync($ops); // réponse perdue, l'appareil renvoie sa file

        $this->assertSame(8, $this->stock());
        $this->assertSame(1, Tenant::run($this->admin->company_id, fn () => Sale::count()));
    }

    public function test_overselling_is_reported_as_a_conflict(): void
    {
        $this->createProductWithStock(1);
        $seller = $this->member('seller');

        Sanctum::actingAs($seller);
        $this->sync([
            ['entity' => 'sale', 'id' => 'V-AAA-0001', 'data' => $this->sale($seller->id)],
            ['entity' => 'movement', 'id' => 'mv_a1', 'data' => $this->movement('p_1', 'out', 2, ['reason' => 'Vente', 'reference' => 'V-AAA-0001'])],
        ])
            ->assertJsonPath('conflicts.0.productId', 'p_1')
            ->assertJsonPath('conflicts.0.stock', -1);
    }

    public function test_other_devices_receive_only_what_changed_since_their_cursor(): void
    {
        $this->createProductWithStock(10);
        Sanctum::actingAs($this->admin);
        $cursor = $this->sync([])->json('cursor');

        $seller = $this->member('seller');
        Sanctum::actingAs($seller);
        $this->sync([
            ['entity' => 'customer', 'id' => 'c_1', 'data' => ['name' => 'Awa Ndiaye', 'phone' => '699 00 00 00']],
            ['entity' => 'sale', 'id' => 'V-AAA-0001', 'data' => $this->sale($seller->id, ['customerId' => 'c_1', 'customerName' => 'Awa Ndiaye'])],
            ['entity' => 'movement', 'id' => 'mv_a1', 'data' => $this->movement('p_1', 'out', 2, ['reason' => 'Vente', 'reference' => 'V-AAA-0001'])],
        ]);

        Sanctum::actingAs($this->admin);
        $response = $this->sync([], $cursor);
        $this->assertSame(['customer', 'sale', 'movement', 'product'], collect($response->json('changes'))->pluck('entity')->all());
        $this->assertSame(8, $this->change($response, 'product', 'p_1')['data']['stock']);
        $this->assertSame(2, $this->change($response, 'sale', 'V-AAA-0001')['data']['items'][0]['qty']);
        $this->assertSame([], $this->sync([], $response->json('cursor'))->json('changes'));
    }

    public function test_a_seller_cannot_touch_stock_prices_or_other_sellers_sales(): void
    {
        $this->createProductWithStock(10);
        $jean = $this->member('seller');
        $marie = $this->member('seller');

        Sanctum::actingAs($marie);
        $this->sync([['entity' => 'sale', 'id' => 'V-BBB-0001', 'data' => $this->sale($marie->id)]]);

        Sanctum::actingAs($jean);
        $response = $this->sync([
            ['entity' => 'product', 'id' => 'p_1', 'data' => $this->product(['price' => 1])],
            ['entity' => 'movement', 'id' => 'mv_x', 'data' => $this->movement('p_1', 'in', 50, ['reason' => 'Correction'])],
            ['entity' => 'sale', 'id' => 'V-BBB-0001', 'data' => ['status' => 'cancelled', 'cancelReason' => 'test']],
            ['entity' => 'sale', 'id' => 'V-AAA-0001', 'data' => $this->sale($marie->id)], // se fait passer pour Marie
        ]);

        $response->assertJsonCount(3, 'rejected');
        $this->assertSame(10, $this->stock());
        // L'appareil reçoit le vrai prix et le vrai stock pour annuler ses modifications locales
        $this->assertSame(3500, $this->change($response, 'product', 'p_1')['data']['price']);
        $this->assertSame(10, $this->change($response, 'product', 'p_1')['data']['stock']);
        $this->assertSame($jean->id, Tenant::run($this->admin->company_id, fn () => Sale::find('V-AAA-0001')->seller_id));
    }

    public function test_payments_from_two_devices_add_up_on_a_credit_sale(): void
    {
        $this->createProductWithStock(10);
        $seller = $this->member('seller');

        Sanctum::actingAs($seller);
        $this->sync([
            ['entity' => 'sale', 'id' => 'V-AAA-0001', 'data' => $this->sale($seller->id, ['mode' => 'credit', 'paid' => 2000, 'installmentId' => 'TR-AAA-1'])],
            ['entity' => 'installment', 'id' => 'TR-AAA-1', 'data' => ['saleId' => 'V-AAA-0001', 'customerName' => 'Awa', 'label' => 'Clé USB', 'total' => 7000, 'dueDate' => '2026-11-19T00:00:00.000Z']],
            ['entity' => 'payment', 'id' => 'pay_1', 'data' => ['installmentId' => 'TR-AAA-1', 'date' => '2026-10-19T09:00:00.000Z', 'amount' => 2000, 'method' => 'cash', 'note' => 'Acompte']],
        ])->assertJsonPath('rejected', []);

        // Deux versements saisis sur deux appareils différents
        Sanctum::actingAs($this->admin);
        $this->sync([['entity' => 'payment', 'id' => 'pay_2', 'data' => ['installmentId' => 'TR-AAA-1', 'date' => '2026-10-20T09:00:00.000Z', 'amount' => 1500, 'method' => 'mobile']]]);
        Sanctum::actingAs($seller);
        $response = $this->sync([['entity' => 'payment', 'id' => 'pay_3', 'data' => ['installmentId' => 'TR-AAA-1', 'date' => '2026-10-21T09:00:00.000Z', 'amount' => 1000, 'method' => 'cash']]]);

        $this->assertCount(3, $this->change($response, 'installment', 'TR-AAA-1')['data']['payments']);
        $this->assertSame(4500, $this->change($response, 'sale', 'V-AAA-0001')['data']['paid']);
    }

    public function test_cancelling_a_sale_returns_the_stock(): void
    {
        $this->createProductWithStock(10);
        $seller = $this->member('seller');

        Sanctum::actingAs($seller);
        $this->sync([
            ['entity' => 'sale', 'id' => 'V-AAA-0001', 'data' => $this->sale($seller->id)],
            ['entity' => 'movement', 'id' => 'mv_a1', 'data' => $this->movement('p_1', 'out', 2, ['reason' => 'Vente', 'reference' => 'V-AAA-0001'])],
        ]);
        $this->sync([
            ['entity' => 'sale', 'id' => 'V-AAA-0001', 'data' => ['status' => 'cancelled', 'cancelReason' => 'Erreur de caisse', 'cancelledAt' => '2026-10-19T10:00:00.000Z']],
            ['entity' => 'movement', 'id' => 'mv_a2', 'data' => $this->movement('p_1', 'in', 2, ['reason' => 'Retour — Erreur de caisse', 'reference' => 'V-AAA-0001'])],
        ])->assertJsonPath('rejected', []);

        $this->assertSame(10, $this->stock());
    }

    public function test_device_codes_are_unique_and_sync_stays_inside_the_company(): void
    {
        Sanctum::actingAs($this->admin);
        $codes = collect(range(1, 5))->map(fn () => $this->postJson('/api/devices')->assertCreated()->json('code'));
        $this->assertCount(5, $codes->unique());

        $this->createProductWithStock(10);
        Sanctum::actingAs(User::factory()->admin()->create());
        $response = $this->sync([]);
        $this->assertTrue($response->json('reset') === false);
        $this->assertSame([], $response->json('changes'));
        $this->getJson('/api/bootstrap')->assertJsonCount(0, 'products');
    }

    public function test_a_device_without_cursor_is_asked_to_reload(): void
    {
        Sanctum::actingAs($this->admin);
        $this->sync([], null)->assertJsonPath('reset', true);
    }
}
