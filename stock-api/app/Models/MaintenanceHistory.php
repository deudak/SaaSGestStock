<?php

namespace App\Models;

class MaintenanceHistory extends TenantModel
{
    protected $table = 'maintenance_history';

    public $timestamps = false;

    protected $casts = ['date' => 'datetime'];
}
