<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class Sale extends TenantModel
{
    protected $table = 'sales';

    protected $casts = ['date' => 'datetime', 'cancelled_at' => 'datetime'];

    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }
}
