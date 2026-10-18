<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** Outils communs aux tests de synchronisation. */
abstract class SyncTestCase extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create();
    }

    protected function member(string $role, array $attributes = []): User
    {
        return User::factory()->create(['company_id' => $this->admin->company_id, 'role' => $role, ...$attributes]);
    }

    /** Envoie des opérations (upsert par défaut) et renvoie la réponse. */
    protected function sync(array $ops, ?int $cursor = 0): TestResponse
    {
        static $n = 0;
        $ops = array_map(function ($op) use (&$n) {
            $n++;

            return ['opId' => "op_$n", 'action' => 'upsert', 'data' => [], ...$op];
        }, $ops);

        return $this->postJson('/api/sync', ['cursor' => $cursor, 'ops' => $ops])->assertOk();
    }

    /** Dernier état d'une donnée dans les changements renvoyés. */
    protected function change(TestResponse $response, string $entity, string $id): ?array
    {
        return collect($response->json('changes'))->first(fn ($c) => $c['entity'] === $entity && $c['id'] === $id);
    }

    protected function product(array $overrides = []): array
    {
        return ['name' => 'Clé USB 32 Go', 'category' => 'Stockage', 'price' => 3500, 'minPrice' => 3000, 'cost' => 1600, 'alertThreshold' => 5, 'stock' => 999, ...$overrides];
    }

    protected function movement(string $productId, string $type, int $qty, array $overrides = []): array
    {
        return ['productId' => $productId, 'productName' => 'Clé USB 32 Go', 'type' => $type, 'qty' => $qty, 'reason' => 'Stock initial', 'reference' => 'CRÉATION', 'date' => '2026-10-19T08:00:00.000Z', 'userName' => 'Test', ...$overrides];
    }

    protected function sale(string $sellerId, array $overrides = []): array
    {
        return [
            'date' => '2026-10-19T09:00:00.000Z', 'sellerId' => $sellerId, 'customerId' => null, 'customerName' => 'Client de passage',
            'subtotal' => 7000, 'discount' => 0, 'total' => 7000, 'paid' => 7000, 'method' => 'cash', 'mode' => 'cash', 'status' => 'completed',
            'installmentId' => null, 'items' => [['productId' => 'p_1', 'name' => 'Clé USB 32 Go', 'qty' => 2, 'price' => 3500, 'cost' => 1600]],
            ...$overrides,
        ];
    }
}
