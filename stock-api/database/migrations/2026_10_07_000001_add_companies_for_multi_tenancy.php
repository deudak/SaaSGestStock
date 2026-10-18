<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Passage en SaaS multi-entreprises :
// - table `companies` (nom, logo, paramètres de chaque entreprise cliente) ;
// - colonne `company_id` sur les utilisateurs et toutes les tables métier ;
// - clés primaires (company_id, id) : les numéros V-00001, TR-1, BC-0001… recommencent
//   à zéro dans chaque entreprise sans collision ;
// - les données existantes (boutique unique) deviennent l'entreprise n°1.
return new class extends Migration
{
    /** Table => colonne identifiant (clé primaire composite avec company_id) */
    private const KEYED_TABLES = [
        'categories' => 'name',
        'suppliers' => 'id',
        'products' => 'id',
        'customers' => 'id',
        'sales' => 'id',
        'installments' => 'id',
        'installment_payments' => 'id',
        'purchase_orders' => 'id',
        'stock_movements' => 'id',
        'maintenance_tasks' => 'id',
        'maintenance_history' => 'id',
        'tech_sheets' => 'id',
    ];

    /** Tables à clé auto-incrémentée : company_id ajouté, clé inchangée */
    private const ITEM_TABLES = ['sale_items', 'purchase_order_items'];

    /** Lignes enfants => [colonne, table parente] */
    private const CHILDREN = [
        'sale_items' => ['sale_id', 'sales'],
        'installment_payments' => ['installment_id', 'installments'],
        'purchase_order_items' => ['purchase_order_id', 'purchase_orders'],
    ];

    public function up(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->longText('logo')->nullable();
            $table->json('settings')->nullable();
            $table->enum('status', ['actif', 'suspendu'])->default('actif');
            $table->timestamps();
        });

        $companyId = $this->createCompanyFromExistingData();

        foreach (self::CHILDREN as $child => [$column]) {
            Schema::table($child, fn (Blueprint $table) => $table->dropForeign([$column]));
        }

        foreach (['users', ...array_keys(self::KEYED_TABLES), ...self::ITEM_TABLES] as $table) {
            Schema::table($table, fn (Blueprint $t) => $t->unsignedBigInteger('company_id')->nullable()->first());
            if ($companyId) {
                DB::table($table)->update(['company_id' => $companyId]);
            }
            DB::statement("ALTER TABLE `$table` MODIFY `company_id` BIGINT UNSIGNED NOT NULL");
        }

        foreach (self::KEYED_TABLES as $table => $key) {
            DB::statement("ALTER TABLE `$table` DROP PRIMARY KEY, ADD PRIMARY KEY (`company_id`, `$key`)");
        }

        foreach (['users', ...array_keys(self::KEYED_TABLES), ...self::ITEM_TABLES] as $table) {
            Schema::table($table, fn (Blueprint $t) => $t->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete());
        }

        foreach (self::CHILDREN as $child => [$column, $parent]) {
            Schema::table($child, function (Blueprint $table) use ($column, $parent) {
                $table->foreign(['company_id', $column])->references(['company_id', 'id'])->on($parent)->cascadeOnDelete();
            });
        }

        Schema::dropIfExists('settings');
    }

    public function down(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->unsignedTinyInteger('id')->primary();
            $table->json('data');
            $table->timestamps();
        });

        $company = DB::table('companies')->orderBy('id')->first();
        if ($company) {
            $data = array_merge(json_decode($company->settings ?? '{}', true) ?: [], ['shopName' => $company->name, 'logo' => $company->logo ?? '']);
            DB::table('settings')->insert(['id' => 1, 'data' => json_encode($data), 'created_at' => now(), 'updated_at' => now()]);
        }

        foreach (self::CHILDREN as $child => [$column]) {
            Schema::table($child, fn (Blueprint $table) => $table->dropForeign(['company_id', $column]));
        }

        foreach (['users', ...array_keys(self::KEYED_TABLES), ...self::ITEM_TABLES] as $table) {
            Schema::table($table, fn (Blueprint $t) => $t->dropForeign(['company_id']));
        }

        // Échoue volontairement si deux entreprises partagent un même identifiant.
        foreach (self::KEYED_TABLES as $table => $key) {
            DB::statement("ALTER TABLE `$table` DROP PRIMARY KEY, ADD PRIMARY KEY (`$key`)");
        }

        foreach (['users', ...array_keys(self::KEYED_TABLES), ...self::ITEM_TABLES] as $table) {
            Schema::table($table, fn (Blueprint $t) => $t->dropColumn('company_id'));
        }

        foreach (self::CHILDREN as $child => [$column, $parent]) {
            Schema::table($child, fn (Blueprint $table) => $table->foreign($column)->references('id')->on($parent)->cascadeOnDelete());
        }

        Schema::dropIfExists('companies');
    }

    private function createCompanyFromExistingData(): ?int
    {
        $row = DB::table('settings')->orderBy('id')->first();
        if (! $row && ! DB::table('users')->exists()) {
            return null; // installation neuve : aucune donnée à rattacher
        }

        $settings = $row ? (json_decode($row->data, true) ?: []) : [];
        $name = $settings['shopName'] ?? 'Ma boutique';
        $logo = ($settings['logo'] ?? '') ?: null;
        unset($settings['shopName'], $settings['logo']);

        return DB::table('companies')->insertGetId([
            'name' => $name,
            'logo' => $logo,
            'settings' => json_encode($settings),
            'status' => 'actif',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
};
