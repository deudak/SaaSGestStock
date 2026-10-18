<?php

namespace App\Models;

class PurchaseOrderItem extends TenantModel
{
    protected $table = 'purchase_order_items';

    public $timestamps = false;

    public $incrementing = true;

    protected $keyType = 'int';
}
