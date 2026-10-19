<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Scanner et caisse journalière :
// - code-barres des produits (EAN, UPC, Code 128…) ;
// - sessions de caisse : ouverture avec fond de caisse, mouvements (versement en banque, petites dépenses,
//   apports), clôture avec comptage et écart ;
// - auteur de chaque encaissement, pour savoir dans quelle caisse l'argent est entré.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('barcode', 64)->nullable()->after('sku');
            $table->index(['company_id', 'barcode']);
        });

        Schema::table('installment_payments', function (Blueprint $table) {
            $table->string('received_by', 40)->nullable()->after('note');
        });

        Schema::create('cash_sessions', function (Blueprint $table) {
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('id', 40);
            $table->string('seller_id', 40)->index();
            $table->enum('status', ['open', 'closed'])->default('open');
            $table->dateTime('opened_at');
            $table->dateTime('closed_at')->nullable();
            $table->unsignedBigInteger('opening_float')->default(0);
            $table->json('movements')->nullable();
            $table->unsignedBigInteger('expected_cash')->nullable();
            $table->unsignedBigInteger('counted_cash')->nullable();
            $table->bigInteger('difference')->nullable();
            $table->json('denominations')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();
            $table->primary(['company_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_sessions');
        Schema::table('installment_payments', fn (Blueprint $table) => $table->dropColumn('received_by'));
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['company_id', 'barcode']);
            $table->dropColumn('barcode');
        });
    }
};
