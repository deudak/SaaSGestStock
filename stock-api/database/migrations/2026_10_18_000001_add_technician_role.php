<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Rôle « maintenancier » (technician) et lien des interventions vers son compte.
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE `users` MODIFY `role` ENUM('admin','seller','technician') NOT NULL DEFAULT 'seller'");

        Schema::table('maintenance_tasks', function (Blueprint $table) {
            $table->string('technician_id', 40)->nullable()->after('assigned_to')->index();
        });
        Schema::table('maintenance_history', function (Blueprint $table) {
            $table->string('technician_id', 40)->nullable()->after('technician')->index();
        });
    }

    public function down(): void
    {
        Schema::table('maintenance_history', fn (Blueprint $table) => $table->dropColumn('technician_id'));
        Schema::table('maintenance_tasks', fn (Blueprint $table) => $table->dropColumn('technician_id'));

        DB::table('users')->where('role', 'technician')->update(['role' => 'seller']);
        DB::statement("ALTER TABLE `users` MODIFY `role` ENUM('admin','seller') NOT NULL DEFAULT 'seller'");
    }
};
