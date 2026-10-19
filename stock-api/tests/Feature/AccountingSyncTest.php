<?php

namespace Tests\Feature;

use Laravel\Sanctum\Sanctum;

/** Saisies comptables : réservées à l'administrateur, contrôlées et synchronisées. */
class AccountingSyncTest extends SyncTestCase
{
    private function expense(array $overrides = []): array
    {
        return ['date' => '2026-10-20T08:00:00.000Z', 'account' => '6222', 'label' => 'Loyer octobre', 'amount' => 150000, 'vat' => 0, 'method' => 'transfer', ...$overrides];
    }

    private function entry(array $lines, array $overrides = []): array
    {
        return ['date' => '2026-10-01T00:00:00.000Z', 'journal' => 'OD', 'label' => 'Apport en capital', 'lines' => $lines, ...$overrides];
    }

    public function test_admin_records_expenses_supplier_payments_and_manual_entries(): void
    {
        Sanctum::actingAs($this->admin);
        $response = $this->sync([
            ['entity' => 'expense', 'id' => 'ex_1', 'data' => $this->expense()],
            ['entity' => 'supplierPayment', 'id' => 'sp_1', 'data' => ['date' => '2026-10-21T08:00:00.000Z', 'supplierId' => 's_1', 'amount' => 80000, 'method' => 'cash']],
            ['entity' => 'journalEntry', 'id' => 'je_1', 'data' => $this->entry([
                ['account' => '521', 'debit' => 500000, 'credit' => 0],
                ['account' => '101', 'debit' => 0, 'credit' => 500000],
            ])],
        ])->assertJsonPath('rejected', []);

        $this->assertSame(150000, $this->change($response, 'expense', 'ex_1')['data']['amount']);
        $this->assertSame('521', $this->change($response, 'journalEntry', 'je_1')['data']['lines'][0]['account']);
        $this->getJson('/api/bootstrap')->assertJsonCount(1, 'expenses')->assertJsonCount(1, 'supplierPayments')->assertJsonCount(1, 'journalEntries');
    }

    public function test_unbalanced_or_malformed_entries_are_refused(): void
    {
        Sanctum::actingAs($this->admin);
        $response = $this->sync([
            ['entity' => 'journalEntry', 'id' => 'je_1', 'data' => $this->entry([['account' => '521', 'debit' => 1000, 'credit' => 0], ['account' => '101', 'debit' => 0, 'credit' => 900]])],
            ['entity' => 'journalEntry', 'id' => 'je_2', 'data' => $this->entry([['account' => '521', 'debit' => 1000, 'credit' => 1000], ['account' => '101', 'debit' => 0, 'credit' => 0]])],
            ['entity' => 'journalEntry', 'id' => 'je_3', 'data' => $this->entry([['account' => 'ABC', 'debit' => 1000, 'credit' => 0], ['account' => '101', 'debit' => 0, 'credit' => 1000]])],
            ['entity' => 'expense', 'id' => 'ex_1', 'data' => $this->expense(['vat' => 200000])], // TVA > montant
        ]);

        $response->assertJsonCount(4, 'rejected');
        $this->assertStringContainsString('déséquilibrée', $response->json('rejected.0.error'));
    }

    public function test_sellers_and_technicians_never_see_nor_write_accounting(): void
    {
        Sanctum::actingAs($this->admin);
        $this->sync([['entity' => 'expense', 'id' => 'ex_1', 'data' => $this->expense()]]);

        foreach (['seller', 'technician'] as $role) {
            Sanctum::actingAs($this->member($role));
            $this->getJson('/api/bootstrap')->assertJsonMissingPath('expenses')->assertJsonMissingPath('journalEntries');
            $response = $this->sync([['entity' => 'expense', 'id' => "ex_$role", 'data' => $this->expense()]]);
            $response->assertJsonCount(1, 'rejected');
            $this->assertNull($this->change($response, 'expense', 'ex_1'));
        }
    }

    public function test_accounting_settings_are_saved_on_the_company(): void
    {
        Sanctum::actingAs($this->admin);
        $this->putJson('/api/company', ['settings' => ['accountingStart' => '2026-01-01', 'openingCash' => 250000, 'openingPayables' => 40000]])
            ->assertOk()
            ->assertJsonPath('settings.accountingStart', '2026-01-01')
            ->assertJsonPath('settings.openingCash', 250000);

        $this->putJson('/api/company', ['settings' => ['accountingStart' => '01/01/2026']])->assertStatus(422);
    }
}
