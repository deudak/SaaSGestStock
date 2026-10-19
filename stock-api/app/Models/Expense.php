<?php

namespace App\Models;

class Expense extends TenantModel
{
    protected $table = 'expenses';

    protected $casts = ['date' => 'datetime'];
}
