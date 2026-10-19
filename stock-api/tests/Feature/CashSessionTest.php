<?php

namespace Tests\Feature;

use App\Models\User;
use Laravel\Sanctum\Sanctum;

/** Caisse journalière (sessions de caisse) et codes-barres des produits. */
class CashSessionTest extends SyncTestCase
{
    private User $seller;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seller = $this->member('seller');
    }

    private function till(array $overrides = []): array
    {
        return ['status' => 'open', 'openedAt' => '2026-10-22T07:00:00.000Z', 'openingFloat' => 20000, 'movements' => [], ...$overrides];
    }

    public function test_seller_opens_and_closes_their_till(): void
    {
        Sanctum::actingAs($this->seller);
        $response = $this->sync([['entity' => 'cashSession', 'id' => 'cs_1', 'data' => $this->till(['sellerId' => 'u_quelquun'])]])->assertJsonPath('rejected', []);
        $this->assertSame($this->seller->id, $this->change($response, 'cashSession', 'cs_1')['data']['sellerId']); // forcé au vendeur

        $closed = $this->till([
            'status' => 'closed',
            'closedAt' => '2026-10-22T19:00:00.000Z',
            'movements' => [['id' => 'm1', 'type' => 'deposit', 'amount' => 50000, 'reason' => 'Versement banque', 'at' => '2026-10-22T15:00:00.000Z']],
            'expectedCash' => 95000,
            'countedCash' => 94500,
            'difference' => -500,
            'denominations' => ['10000' => 9, '1000' => 4, '500' => 1],
        ]);
        $data = $this->change($this->sync([['entity' => 'cashSession', 'id' => 'cs_1', 'data' => $closed]]), 'cashSession', 'cs_1')['data'];
        $this->assertSame('closed', $data['status']);
        $this->assertSame(-500, $data['difference']);
        $this->assertSame('deposit', $data['movements'][0]['type']);
    }

    public function test_only_one_open_till_per_seller(): void
    {
        Sanctum::actingAs($this->seller);
        $this->sync([['entity' => 'cashSession', 'id' => 'cs_1', 'data' => $this->till()]]);
        $this->sync([['entity' => 'cashSession', 'id' => 'cs_2', 'data' => $this->till()]])->assertJsonCount(1, 'rejected');
    }

    public function test_a_closed_till_or_another_sellers_till_cannot_be_changed_by_a_seller(): void
    {
        $other = $this->member('seller');
        Sanctum::actingAs($other);
        $this->sync([['entity' => 'cashSession', 'id' => 'cs_other', 'data' => $this->till()]]);

        Sanctum::actingAs($this->seller);
        $this->sync([['entity' => 'cashSession', 'id' => 'cs_other', 'data' => $this->till(['openingFloat' => 0])]])->assertJsonCount(1, 'rejected');

        $this->sync([['entity' => 'cashSession', 'id' => 'cs_1', 'data' => $this->till(['status' => 'closed', 'closedAt' => '2026-10-22T19:00:00.000Z', 'countedCash' => 20000])]]);
        $this->sync([['entity' => 'cashSession', 'id' => 'cs_1', 'data' => $this->till(['status' => 'closed', 'closedAt' => '2026-10-22T19:00:00.000Z', 'countedCash' => 99999])]])
            ->assertJsonCount(1, 'rejected');

        // L'administrateur peut corriger ou clôturer une caisse oubliée
        Sanctum::actingAs($this->admin);
        $this->sync([['entity' => 'cashSession', 'id' => 'cs_other', 'data' => $this->till(['sellerId' => $other->id, 'status' => 'closed', 'closedAt' => '2026-10-22T20:00:00.000Z', 'countedCash' => 20000])]])
            ->assertJsonPath('rejected', []);
    }

    public function test_technicians_cannot_see_tills_and_payments_record_who_collected(): void
    {
        Sanctum::actingAs($this->member('technician'));
        $this->getJson('/api/bootstrap')->assertJsonMissingPath('cashSessions');

        Sanctum::actingAs($this->seller);
        $this->sync([
            ['entity' => 'installment', 'id' => 'TR-1', 'data' => ['customerName' => 'Awa', 'label' => 'Crédit', 'total' => 10000, 'dueDate' => '2026-11-22T00:00:00.000Z']],
            ['entity' => 'payment', 'id' => 'pay_1', 'data' => ['installmentId' => 'TR-1', 'date' => '2026-10-22T10:00:00.000Z', 'amount' => 3000, 'method' => 'cash', 'receivedBy' => 'quelquun']],
        ]);
        $payments = collect($this->getJson('/api/bootstrap')->json('installments'))->firstWhere('id', 'TR-1')['payments'];
        $this->assertSame($this->seller->id, $payments[0]['receivedBy']);
    }

    public function test_products_keep_their_barcode(): void
    {
        Sanctum::actingAs($this->admin);
        $response = $this->sync([['entity' => 'product', 'id' => 'p_1', 'data' => $this->product(['barcode' => '6001234567890'])]]);
        $this->assertSame('6001234567890', $this->change($response, 'product', 'p_1')['data']['barcode']);
    }
}
