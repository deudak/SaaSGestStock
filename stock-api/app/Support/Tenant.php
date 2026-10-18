<?php

namespace App\Support;

/**
 * Entreprise de l'utilisateur connecté pour la requête en cours.
 * Définie par le middleware SetCurrentCompany, lue par le trait BelongsToCompany.
 */
class Tenant
{
    private static ?int $companyId = null;

    public static function set(?int $companyId): void
    {
        self::$companyId = $companyId;
    }

    public static function id(): ?int
    {
        return self::$companyId;
    }

    public static function forget(): void
    {
        self::$companyId = null;
    }

    /** Exécute un traitement dans le contexte d'une entreprise (commandes, tâches planifiées…). */
    public static function run(int $companyId, callable $callback): mixed
    {
        $previous = self::$companyId;
        self::$companyId = $companyId;
        try {
            return $callback();
        } finally {
            self::$companyId = $previous;
        }
    }
}
