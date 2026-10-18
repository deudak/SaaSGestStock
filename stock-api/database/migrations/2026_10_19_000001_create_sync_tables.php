<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Synchronisation entre appareils :
// - sync_log : journal des changements, lu par chaque appareil depuis son dernier curseur ;
// - devices : code unique par appareil, utilisé dans les numéros (V-K7Q-0001) pour
//   qu'aucun appareil hors ligne ne réutilise le numéro d'un autre.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sync_log', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('entity', 20);
            $table->string('record_id', 100);
            $table->enum('action', ['upsert', 'delete']);
            $table->timestamp('created_at')->useCurrent();
            $table->index(['company_id', 'id']);
        });

        Schema::create('devices', function (Blueprint $table) {
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('code', 8);
            $table->string('user_id', 40)->nullable();
            $table->string('label')->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();
            $table->primary(['company_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('devices');
        Schema::dropIfExists('sync_log');
    }
};
