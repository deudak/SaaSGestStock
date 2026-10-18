<?php

namespace App\Http\Middleware;

use App\Support\Tenant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Après auth:sanctum : refuse les comptes désactivés et les entreprises suspendues,
 * puis limite toute la requête aux données de l'entreprise de l'utilisateur.
 */
class SetCurrentCompany
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->isActive()) {
            $user?->currentAccessToken()?->delete();
            return response()->json(['message' => 'Ce compte est désactivé. Contactez l\'administrateur.'], 403);
        }

        if (! $user->company?->isActive()) {
            return response()->json(['message' => 'L\'abonnement de cette entreprise est suspendu.'], 403);
        }

        Tenant::set($user->company_id);

        try {
            return $next($request);
        } finally {
            Tenant::forget();
        }
    }
}
