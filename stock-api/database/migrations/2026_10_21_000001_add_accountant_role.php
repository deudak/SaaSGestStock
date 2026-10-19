<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Rôle « comptable » (accountant) : accès à la comptabilité de son entreprise.
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE `users` MODIFY `role` ENUM('admin','seller','technician','accountant') NOT NULL DEFAULT 'seller'");
    }

    public function down(): void
    {
        DB::table('users')->where('role', 'accountant')->update(['role' => 'seller']);
        DB::statement("ALTER TABLE `users` MODIFY `role` ENUM('admin','seller','technician') NOT NULL DEFAULT 'seller'");
    }
};
