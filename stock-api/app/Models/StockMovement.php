<?php

namespace App\Models;

class StockMovement extends TenantModel
{
    protected $table = 'stock_movements';

    public $timestamps = false;

    protected $casts = ['date' => 'datetime'];
}
