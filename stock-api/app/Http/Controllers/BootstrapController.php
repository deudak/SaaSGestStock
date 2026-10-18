<?php

namespace App\Http\Controllers;

use App\Sync\Records;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Toutes les données de l'entreprise de l'utilisateur, au format du store du front.
 * Sert à initialiser un appareil (premier lancement, nouvel ordinateur…) ; ensuite
 * l'appareil ne récupère que les changements via POST /sync à partir de « cursor ».
 * Un maintenancier ne reçoit que la maintenance (ni ventes, ni stock, ni clients).
 */
class BootstrapController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        // Curseur lu avant les données : un changement concurrent sera simplement renvoyé deux fois
        $data = ['cursor' => SyncController::currentCursor()];

        foreach (Records::visibleTo($user->role) as $entity) {
            $data[Records::ENTITIES[$entity][1]] = Records::all($entity);
        }
        $data['users'] = $user->company->users()->orderBy('created_at')->get()->map->toClient()->values();

        return response()->json($data);
    }
}
