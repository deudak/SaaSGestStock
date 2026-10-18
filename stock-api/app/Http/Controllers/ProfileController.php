<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

/** Profil de l'utilisateur connecté (admin ou vendeur). */
class ProfileController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:50'],
            'shop' => ['nullable', 'string', 'max:255'],
        ], ['email.unique' => 'Cet email est déjà utilisé.']);

        $user->fill($data)->save();

        return response()->json($user->toClient());
    }

    public function password(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:6', 'max:255'],
        ]);

        $user = $request->user();
        if (! Hash::check($data['current_password'], $user->password)) {
            return response()->json(['message' => 'Le mot de passe actuel est incorrect.', 'errors' => ['current_password' => ['Le mot de passe actuel est incorrect.']]], 422);
        }

        $user->password = $data['password'];
        $user->save();
        // Les autres appareils devront se reconnecter
        $user->tokens()->whereKeyNot($user->currentAccessToken()->id)->delete();

        return response()->json(['ok' => true]);
    }
}
