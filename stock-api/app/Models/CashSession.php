<?php

namespace App\Models;

class CashSession extends TenantModel
{
    protected $table = 'cash_sessions';

    protected $casts = [
        'opened_at' => 'datetime',
        'closed_at' => 'datetime',
        'movements' => 'array',
        'denominations' => 'array',
    ];
}
