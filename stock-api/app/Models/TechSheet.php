<?php

namespace App\Models;

class TechSheet extends TenantModel
{
    protected $table = 'tech_sheets';

    public $timestamps = false;

    protected $casts = ['purchase_date' => 'datetime'];
}
