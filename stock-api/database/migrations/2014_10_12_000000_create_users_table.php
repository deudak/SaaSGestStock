<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Identifiants texte (« u_xxx ») générés aussi par le front hors ligne.
        Schema::create('users', function (Blueprint $table) {
            $table->string('id', 40)->primary();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('phone')->nullable();
            $table->string('password');
            $table->enum('role', ['admin', 'seller'])->default('seller');
            $table->string('shop')->nullable();
            $table->enum('status', ['actif', 'inactif'])->default('actif');
            $table->rememberToken();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
