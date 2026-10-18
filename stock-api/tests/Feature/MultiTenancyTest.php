<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\Product;
use App\Models\Sale;
use App\Models\User;
use App\Support\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Chaque entreprise ne voit et ne modifie que ses propres données. */
class MultiTenancyTest extends TestCase
{
    use RefreshDatabase;

    private User $adminA;

    private User $adminB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->adminA = User::factory()->admin()->create(['email' => 'admin@a.test']);
        $this->adminB = User::factory()->admin()->create(['email' => 'admin@b.test']);
    }

    public function test_register_creates_a_new_company_with_its_admin(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'company_name' => 'Tech Akwa',
            'name' => 'Awa Ndiaye',
            'email' => 'awa@techakwa.test',
            'password' => 'Secret123',
        ]);

        $response->assertCreated()
            ->assertJsonPath('company.name', 'Tech Akwa')
            ->assertJsonPath('user.role', 'admin')
            ->assertJsonStructure(['token', 'company' => ['id', 'logo', 'settings' => ['brandColor']]]);

        $this->assertNotContains($response->json('company.id'), [$this->adminA->company_id, $this->adminB->company_id]);
    }

    public function test_login_returns_the_users_own_company(): void
    {
        $this->postJson('/api/auth/login', ['email' => 'admin@a.test', 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('company.id', $this->adminA->company_id);

        $this->postJson('/api/auth/login', ['email' => 'admin@a.test', 'password' => 'mauvais'])->assertStatus(401);
    }

    public function test_users_list_only_contains_the_same_company(): void
    {
        $sellerA = User::factory()->create(['company_id' => $this->adminA->company_id]);

        Sanctum::actingAs($this->adminB);
        $ids = collect($this->getJson('/api/users')->assertOk()->json())->pluck('id');

        $this->assertContains($this->adminB->id, $ids);
        $this->assertNotContains($sellerA->id, $ids);
        $this->assertNotContains($this->adminA->id, $ids);
    }

    public function test_an_admin_cannot_modify_or_delete_another_companys_account(): void
    {
        $sellerA = User::factory()->create(['company_id' => $this->adminA->company_id]);

        Sanctum::actingAs($this->adminB);
        $this->putJson("/api/users/{$sellerA->id}", ['status' => 'inactif'])->assertNotFound();
        $this->deleteJson("/api/users/{$sellerA->id}")->assertNotFound();

        $this->assertSame('actif', $sellerA->fresh()->status);
    }

    public function test_created_employees_belong_to_the_admins_company(): void
    {
        Sanctum::actingAs($this->adminA);
        $id = $this->postJson('/api/users', ['name' => 'Jean', 'email' => 'jean@a.test', 'password' => 'secret1', 'company_id' => $this->adminB->company_id])
            ->assertCreated()
            ->json('id');

        $this->assertSame($this->adminA->company_id, User::find($id)->company_id);
    }

    public function test_branding_is_private_to_each_company(): void
    {
        Sanctum::actingAs($this->adminA);
        $this->putJson('/api/company', ['name' => 'Boutique A', 'settings' => ['brandColor' => '#16a34a', 'tagline' => 'Téléphonie']])
            ->assertOk()
            ->assertJsonPath('settings.brandColor', '#16a34a');

        Sanctum::actingAs($this->adminB);
        $this->getJson('/api/me')
            ->assertJsonPath('company.id', $this->adminB->company_id)
            ->assertJsonPath('company.settings.brandColor', Company::DEFAULT_SETTINGS['brandColor']);
        $this->assertNotSame('Boutique A', $this->getJson('/api/company')->json('name'));
    }

    public function test_a_seller_cannot_change_company_settings(): void
    {
        Sanctum::actingAs(User::factory()->create(['company_id' => $this->adminA->company_id]));

        $this->putJson('/api/company', ['name' => 'Piratée'])->assertForbidden();
        $this->postJson('/api/users', ['name' => 'X', 'email' => 'x@a.test', 'password' => 'secret1'])->assertForbidden();
    }

    public function test_same_sale_number_in_two_companies_stays_separate(): void
    {
        $sale = ['id' => 'V-00001', 'date' => now(), 'customer_name' => 'Client', 'total' => 1000];
        Tenant::run($this->adminA->company_id, fn () => Sale::create([...$sale, 'total' => 1000]));
        Tenant::run($this->adminB->company_id, fn () => Sale::create([...$sale, 'total' => 5000]));

        // Une mise à jour dans A ne touche pas la vente homonyme de B
        Tenant::run($this->adminA->company_id, fn () => Sale::find('V-00001')->update(['total' => 1500]));

        Sanctum::actingAs($this->adminB);
        $this->getJson('/api/bootstrap')
            ->assertOk()
            ->assertJsonCount(1, 'sales')
            ->assertJsonPath('sales.0.total', 5000);

        Sanctum::actingAs($this->adminA);
        $this->getJson('/api/bootstrap')->assertJsonPath('sales.0.total', 1500);
    }

    public function test_bootstrap_never_returns_another_companys_data(): void
    {
        Tenant::run($this->adminA->company_id, fn () => Product::create(['id' => 'p_a', 'name' => 'Produit A']));

        Sanctum::actingAs($this->adminB);
        $this->getJson('/api/bootstrap')->assertOk()->assertJsonCount(0, 'products')->assertJsonCount(1, 'users');
    }

    public function test_deactivated_accounts_are_locked_out(): void
    {
        $seller = User::factory()->create(['company_id' => $this->adminA->company_id, 'email' => 'seller@a.test', 'status' => 'inactif']);

        $this->postJson('/api/auth/login', ['email' => 'seller@a.test', 'password' => 'password'])->assertForbidden();

        Sanctum::actingAs($seller);
        $this->getJson('/api/me')->assertForbidden();
    }

    public function test_suspended_company_is_locked_out(): void
    {
        $this->adminA->company->forceFill(['status' => 'suspendu'])->save();

        $this->postJson('/api/auth/login', ['email' => 'admin@a.test', 'password' => 'password'])->assertForbidden();
    }
}
