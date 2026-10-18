<?php

namespace App\Models\Concerns;

use App\Models\Company;
use App\Support\Tenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/**
 * Isole les données par entreprise :
 * - toute requête est filtrée sur l'entreprise courante (et ne renvoie rien sans entreprise, hors console) ;
 * - toute création est rattachée d'office à l'entreprise courante ;
 * - les mises à jour / suppressions ciblent (company_id, id), la clé primaire réelle.
 */
trait BelongsToCompany
{
    public static function bootBelongsToCompany(): void
    {
        static::addGlobalScope('company', function (Builder $query) {
            $companyId = Tenant::id();
            if ($companyId !== null) {
                $query->where($query->qualifyColumn('company_id'), $companyId);
            } elseif (! app()->runningInConsole()) {
                $query->whereRaw('1 = 0'); // par sécurité : aucune entreprise, aucune donnée
            }
        });

        static::creating(function ($model) {
            $companyId = Tenant::id();
            if ($companyId !== null) {
                $model->company_id = $companyId;
            } elseif (empty($model->company_id)) {
                throw new LogicException('Impossible de créer '.static::class.' sans entreprise.');
            }
        });

        static::updating(function ($model) {
            if ($model->isDirty('company_id')) {
                throw new LogicException('Une donnée ne peut pas changer d\'entreprise.');
            }
        });
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    protected function setKeysForSaveQuery($query)
    {
        return parent::setKeysForSaveQuery($query)->where('company_id', $this->getOriginal('company_id', $this->company_id));
    }

    protected function setKeysForSelectQuery($query)
    {
        return parent::setKeysForSelectQuery($query)->where('company_id', $this->getOriginal('company_id', $this->company_id));
    }
}
