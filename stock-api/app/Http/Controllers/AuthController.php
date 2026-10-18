<?php

namespace App\Http\Controllers;

use App\Models\Company;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    /** Inscription d'une nouvelle entreprise cliente : son créateur en devient l'administrateur. */
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'company_name' => ['required', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:50'],
            'password' => ['required', 'string', 'min:8', 'max:255'],
        ], [
            'email.unique' => 'Un compte existe déjà avec cet email.',
        ]);

        $user = DB::transaction(function () use ($data) {
            $company = Company::create(['name' => $data['company_name'], 'settings' => Company::DEFAULT_SETTINGS]);

            $user = new User([
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'password' => $data['password'],
                'role' => 'admin',
                'shop' => 'Siège',
                'status' => 'actif',
            ]);
            $user->company_id = $company->id;
            $user->save();

            return $user;
        });

        return response()->json($this->session($user, $request), 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::with('company')->where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Email ou mot de passe incorrect.'], 401);
        }
        if (! $user->isActive()) {
            return response()->json(['message' => 'Ce compte est désactivé. Contactez l\'administrateur.'], 403);
        }
        if (! $user->company?->isActive()) {
            return response()->json(['message' => 'L\'abonnement de cette entreprise est suspendu.'], 403);
        }

        return response()->json($this->session($user, $request));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['ok' => true]);
    }

    /** Utilisateur et entreprise courants (rafraîchis par le front à chaque retour en ligne). */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json(['user' => $user->toClient(), 'company' => $user->company->toClient()]);
    }

    private function session(User $user, Request $request): array
    {
        $token = $user->createToken(substr($request->userAgent() ?: 'navigateur', 0, 255))->plainTextToken;

        return ['token' => $token, 'user' => $user->toClient(), 'company' => $user->company->toClient()];
    }
}
