<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

/**
 * Base des données métier d'une entreprise : identifiants texte générés par le front
 * (fonctionnement hors ligne), clé réelle (company_id, id), company_id jamais assignable.
 */
abstract class TenantModel extends Model
{
    use BelongsToCompany;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = ['company_id'];
}
