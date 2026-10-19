<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Comptabilité (SYSCOHADA) : les écritures des ventes, encaissements et achats sont calculées
// à partir des opérations ; seules les saisies propres à la comptabilité sont stockées ici.
return new class extends Migration
{
    public function up(): void
    {
        // Dépenses : loyer, électricité, salaires, transport… (compte de charge de classe 6)
        Schema::create('expenses', function (Blueprint $table) {
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('id', 40);
            $table->dateTime('date')->index();
            $table->string('account', 10);
            $table->string('label');
            $table->unsignedBigInteger('amount');
            $table->unsignedBigInteger('vat')->default(0);
            $table->string('method', 20)->default('cash');
            $table->string('supplier_id', 40)->nullable();
            $table->string('reference', 60)->nullable();
            $table->text('note')->nullable();
            $table->string('maintenance_history_id', 40)->nullable();
            $table->timestamps();
            $table->primary(['company_id', 'id']);
        });

        // Règlements des fournisseurs (solde du compte 401)
        Schema::create('supplier_payments', function (Blueprint $table) {
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('id', 40);
            $table->dateTime('date')->index();
            $table->string('supplier_id', 40)->nullable();
            $table->string('purchase_order_id', 40)->nullable();
            $table->unsignedBigInteger('amount');
            $table->string('method', 20)->default('cash');
            $table->text('note')->nullable();
            $table->timestamps();
            $table->primary(['company_id', 'id']);
        });

        // Écritures saisies à la main (opérations diverses, capital, emprunts, virements…)
        Schema::create('journal_entries', function (Blueprint $table) {
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('id', 40);
            $table->dateTime('date')->index();
            $table->string('journal', 4)->default('OD');
            $table->string('label');
            $table->string('reference', 60)->nullable();
            $table->json('lines');
            $table->timestamps();
            $table->primary(['company_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('journal_entries');
        Schema::dropIfExists('supplier_payments');
        Schema::dropIfExists('expenses');
    }
};
