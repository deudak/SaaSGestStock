<?php

namespace App\Models;

class InstallmentPayment extends TenantModel
{
    protected $table = 'installment_payments';

    public $timestamps = false;

    protected $casts = ['date' => 'datetime'];
}
