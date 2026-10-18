<?php

namespace App\Models;

class Category extends TenantModel
{
    protected $table = 'categories';

    public $timestamps = false;

    protected $primaryKey = 'name';
}
