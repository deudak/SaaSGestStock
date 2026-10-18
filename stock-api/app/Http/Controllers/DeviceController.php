<?php

namespace App\Http\Controllers;

use App\Support\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Attribue à chaque appareil un code unique dans l'entreprise (ex. « K7Q »).
 * Il préfixe les numéros créés hors ligne (V-K7Q-0001) : deux appareils ne peuvent
 * jamais produire le même numéro de vente, de dossier ou de bon de commande.
 */
class DeviceController extends Controller
{
    // Sans O/0 ni I/1 pour rester lisible sur une facture
    private const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    public function store(Request $request): JsonResponse
    {
        $label = substr((string) $request->input('label', $request->userAgent() ?? ''), 0, 255);

        for ($attempt = 0; $attempt < 50; $attempt++) {
            $length = $attempt < 40 ? 3 : 4;
            $code = '';
            for ($i = 0; $i < $length; $i++) {
                $code .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];
            }

            $inserted = DB::table('devices')->insertOrIgnore([
                'company_id' => Tenant::id(),
                'code' => $code,
                'user_id' => $request->user()->id,
                'label' => $label,
                'last_seen_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            if ($inserted) {
                return response()->json(['code' => $code], 201);
            }
        }

        return response()->json(['message' => 'Impossible d\'attribuer un code à cet appareil.'], 500);
    }
}
