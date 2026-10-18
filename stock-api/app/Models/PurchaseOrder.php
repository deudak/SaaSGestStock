<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchaseOrder extends TenantModel
{
    protected $table = 'purchase_orders';

    protected $casts = ['expected_at' => 'datetime', 'received_at' => 'datetime'];

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }
}
