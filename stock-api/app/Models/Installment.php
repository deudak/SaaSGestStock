<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class Installment extends TenantModel
{
    protected $table = 'installments';

    protected $casts = ['due_date' => 'datetime', 'cancelled' => 'boolean'];

    public function payments(): HasMany
    {
        return $this->hasMany(InstallmentPayment::class);
    }
}
