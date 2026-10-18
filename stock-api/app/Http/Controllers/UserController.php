<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Comptes de l'entreprise (administrateurs et vendeurs).
 * Toutes les recherches passent par $company->users() : un compte d'une autre entreprise est introuvable.
 */
class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $users = $request->user()->company->users()->orderBy('created_at')->get();

        return response()->json($users->map->toClient()->values());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:50'],
            'shop' => ['nullable', 'string', 'max:255'],
            'role' => ['sometimes', Rule::in(['admin', 'seller', 'technician'])],
            'status' => ['sometimes', Rule::in(['actif', 'inactif'])],
            'password' => ['required', 'string', 'min:6', 'max:255'],
        ], $this->messages());

        $user = new User(['role' => 'seller', 'status' => 'actif', ...$data]);
        $user->company_id = $request->user()->company_id;
        $user->save();

        return response()->json($user->toClient(), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $user = $this->findMember($request, $id);
        $isSelf = $user->is($request->user());

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'shop' => ['sometimes', 'nullable', 'string', 'max:255'],
            'role' => ['sometimes', Rule::in(['admin', 'seller', 'technician'])],
            'status' => ['sometimes', Rule::in(['actif', 'inactif'])],
            'password' => ['sometimes', 'nullable', 'string', 'min:6', 'max:255'],
        ], $this->messages());

        if ($isSelf && (($data['status'] ?? 'actif') !== 'actif' || ($data['role'] ?? 'admin') !== 'admin')) {
            return response()->json(['message' => 'Vous ne pouvez pas désactiver ni rétrograder votre propre compte.'], 422);
        }
        if (empty($data['password'])) {
            unset($data['password']);
        }

        $user->fill($data)->save();

        if (($data['status'] ?? null) === 'inactif' || isset($data['password'])) {
            // Déconnecte le compte partout (sauf la session de l'admin qui modifie son propre mot de passe)
            $user->tokens()->when($isSelf, fn ($q) => $q->whereKeyNot($request->user()->currentAccessToken()->id))->delete();
        }

        return response()->json($user->toClient());
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $this->findMember($request, $id);

        if ($user->is($request->user())) {
            return response()->json(['message' => 'Vous ne pouvez pas supprimer votre propre compte.'], 422);
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->json(['ok' => true]);
    }

    private function findMember(Request $request, string $id): User
    {
        return $request->user()->company->users()->findOrFail($id);
    }

    private function messages(): array
    {
        return ['email.unique' => 'Cet email est déjà utilisé.'];
    }
}
