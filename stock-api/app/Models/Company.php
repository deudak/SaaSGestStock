<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Entreprise cliente du SaaS : son nom, son logo et ses paramètres
 * (couleur, coordonnées, règles de vente…) ne sont visibles que par ses utilisateurs.
 */
class Company extends Model
{
    /** Paramètres modifiables par l'administrateur de l'entreprise, avec leur valeur par défaut */
    public const DEFAULT_SETTINGS = [
        'tagline' => '',
        'brandColor' => '#2554eb',
        'address' => '',
        'phone' => '',
        'email' => '',
        'taxId' => '',
        'currency' => 'F',
        'taxRate' => 0,
        'defaultAlertThreshold' => 5,
        'maxDiscountPercent' => 10,
        'invoiceFooter' => 'Merci pour votre confiance.',
        'emailNotifications' => true,
        'allowSellerCredit' => true,
    ];

    protected $fillable = ['name', 'logo', 'settings'];

    protected $casts = [
        'settings' => 'array',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function isActive(): bool
    {
        return $this->status === 'actif';
    }

    /** Format attendu par le front (identique à state.settings). */
    public function toClient(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'logo' => $this->logo ?? '',
            'settings' => array_merge(self::DEFAULT_SETTINGS, array_intersect_key($this->settings ?? [], self::DEFAULT_SETTINGS)),
        ];
    }
}
