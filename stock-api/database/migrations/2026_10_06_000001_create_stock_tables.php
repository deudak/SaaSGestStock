<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Tables métier de DYM Stock (version mono-boutique, reconstituée à partir de la base existante).
// La séparation par entreprise est ajoutée par la migration 2026_10_07_000001.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->string('name', 100)->primary();
            $table->unsignedInteger('position')->default(0);
        });

        Schema::create('suppliers', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('name');
            $table->string('contact')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('category')->nullable();
            $table->string('address')->nullable();
            $table->string('status', 30)->default('Actif');
            $table->unsignedTinyInteger('rating')->default(4);
            $table->unsignedInteger('delay')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('sku', 60)->nullable()->index();
            $table->string('name');
            $table->string('category', 100)->nullable()->index();
            $table->string('supplier_id', 40)->nullable()->index();
            $table->unsignedBigInteger('price')->default(0);
            $table->unsignedBigInteger('min_price')->default(0);
            $table->unsignedBigInteger('cost')->default(0);
            $table->integer('stock')->default(0);
            $table->unsignedInteger('alert_threshold')->default(0);
            $table->longText('image')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('customers', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('name');
            $table->string('phone')->nullable()->index();
            $table->string('email')->nullable();
            $table->string('city')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('sales', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->dateTime('date')->index();
            $table->string('seller_id', 40)->nullable()->index();
            $table->string('customer_id', 40)->nullable()->index();
            $table->string('customer_name');
            $table->unsignedBigInteger('subtotal')->default(0);
            $table->unsignedBigInteger('discount')->default(0);
            $table->unsignedBigInteger('total')->default(0);
            $table->unsignedBigInteger('paid')->default(0);
            $table->string('method', 20)->default('cash');
            $table->enum('mode', ['cash', 'credit'])->default('cash');
            $table->enum('status', ['completed', 'cancelled'])->default('completed');
            $table->string('installment_id', 40)->nullable();
            $table->string('cancel_reason')->nullable();
            $table->dateTime('cancelled_at')->nullable();
            $table->timestamps();
        });

        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();
            $table->string('sale_id', 40)->index();
            $table->string('product_id', 40)->nullable();
            $table->string('name');
            $table->unsignedInteger('qty');
            $table->unsignedBigInteger('price');
            $table->unsignedBigInteger('cost')->default(0);
            $table->foreign('sale_id')->references('id')->on('sales')->cascadeOnDelete();
        });

        Schema::create('installments', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('sale_id', 40)->nullable()->index();
            $table->string('customer_id', 40)->nullable()->index();
            $table->string('customer_name');
            $table->string('label', 500);
            $table->unsignedBigInteger('total');
            $table->dateTime('due_date');
            $table->string('seller_id', 40)->nullable()->index();
            $table->text('notes')->nullable();
            $table->boolean('cancelled')->default(false);
            $table->timestamps();
        });

        Schema::create('installment_payments', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('installment_id', 40)->index();
            $table->dateTime('date');
            $table->unsignedBigInteger('amount');
            $table->string('method', 20)->default('cash');
            $table->string('note')->nullable();
            $table->foreign('installment_id')->references('id')->on('installments')->cascadeOnDelete();
        });

        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('supplier_id', 40)->nullable()->index();
            $table->enum('status', ['draft', 'sent', 'received', 'cancelled'])->default('draft');
            $table->dateTime('expected_at')->nullable();
            $table->dateTime('received_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('purchase_order_items', function (Blueprint $table) {
            $table->id();
            $table->string('purchase_order_id', 40)->index();
            $table->string('product_id', 40)->nullable();
            $table->string('name');
            $table->unsignedInteger('qty');
            $table->unsignedBigInteger('cost')->default(0);
            $table->foreign('purchase_order_id')->references('id')->on('purchase_orders')->cascadeOnDelete();
        });

        Schema::create('stock_movements', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('product_id', 40)->nullable()->index();
            $table->string('product_name');
            $table->enum('type', ['in', 'out']);
            $table->unsignedInteger('qty');
            $table->string('reason');
            $table->string('reference', 60)->nullable();
            $table->dateTime('date')->index();
            $table->string('user_name')->nullable();
        });

        Schema::create('maintenance_tasks', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('product');
            $table->text('task');
            $table->dateTime('date');
            $table->string('status', 30)->default('Planifié');
            $table->string('assigned_to')->nullable();
            $table->unsignedBigInteger('cost_estimate')->default(0);
            $table->enum('source', ['admin', 'seller'])->default('admin');
            $table->string('reported_by', 40)->nullable();
            $table->timestamps();
        });

        Schema::create('maintenance_history', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('product');
            $table->string('action');
            $table->string('technician')->nullable();
            $table->dateTime('date');
            $table->unsignedBigInteger('cost')->default(0);
            $table->text('note')->nullable();
        });

        Schema::create('tech_sheets', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('product');
            $table->string('model')->nullable();
            $table->text('info')->nullable();
            $table->unsignedBigInteger('original_value')->default(0);
            $table->dateTime('purchase_date')->nullable();
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->unsignedTinyInteger('id')->primary();
            $table->json('data');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['settings', 'tech_sheets', 'maintenance_history', 'maintenance_tasks', 'stock_movements', 'purchase_order_items', 'purchase_orders', 'installment_payments', 'installments', 'sale_items', 'sales', 'customers', 'products', 'suppliers', 'categories'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
