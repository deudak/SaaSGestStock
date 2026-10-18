<?php

namespace App\Models;

class SaleItem extends TenantModel
{
    protected $table = 'sale_items';

    public $timestamps = false;

    public $incrementing = true;

    protected $keyType = 'int';
}
