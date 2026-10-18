<?php

namespace App\Models;

class MaintenanceTask extends TenantModel
{
    protected $table = 'maintenance_tasks';

    protected $casts = ['date' => 'datetime'];
}
