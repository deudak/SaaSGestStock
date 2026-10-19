<?php

namespace App\Models;

class SupplierPayment extends TenantModel
{
    protected $table = 'supplier_payments';

    protected $casts = ['date' => 'datetime'];
}
