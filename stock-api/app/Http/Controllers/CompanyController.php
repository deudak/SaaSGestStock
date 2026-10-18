<?php

namespace App\Http\Controllers;

use App\Models\Company;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Identité et paramètres de l'entreprise de l'utilisateur connecté (jamais d'une autre). */
class CompanyController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json($request->user()->company->toClient());
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            // Logo envoyé en data URL (déjà redimensionné par le front) — 2 Mo maximum
            'logo' => ['sometimes', 'nullable', 'string', 'max:2800000', 'regex:/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,/'],
            'settings' => ['sometimes', 'array'],
            'settings.tagline' => ['nullable', 'string', 'max:255'],
            'settings.brandColor' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'settings.address' => ['nullable', 'string', 'max:255'],
            'settings.phone' => ['nullable', 'string', 'max:50'],
            'settings.email' => ['nullable', 'string', 'max:255'],
            'settings.taxId' => ['nullable', 'string', 'max:100'],
            'settings.currency' => ['nullable', 'string', 'max:10'],
            'settings.taxRate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'settings.defaultAlertThreshold' => ['nullable', 'integer', 'min:0'],
            'settings.maxDiscountPercent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'settings.invoiceFooter' => ['nullable', 'string', 'max:1000'],
            'settings.emailNotifications' => ['nullable', 'boolean'],
            'settings.allowSellerCredit' => ['nullable', 'boolean'],
        ], [
            'logo.regex' => 'Le logo doit être une image.',
            'logo.max' => 'Le logo est trop lourd (2 Mo maximum).',
            'settings.brandColor.regex' => 'Couleur invalide.',
        ]);

        $company = $request->user()->company;

        if (array_key_exists('name', $data)) {
            $company->name = $data['name'];
        }
        if (array_key_exists('logo', $data)) {
            $company->logo = $data['logo'] ?: null;
        }
        if (isset($data['settings'])) {
            $settings = $company->settings ?? [];
            foreach (array_intersect_key($data['settings'], Company::DEFAULT_SETTINGS) as $key => $value) {
                // Un champ texte vidé arrive à null (ConvertEmptyStringsToNull)
                if ($value === null && ! is_string(Company::DEFAULT_SETTINGS[$key])) {
                    continue;
                }
                $settings[$key] = $value ?? '';
            }
            $company->settings = $settings;
        }
        $company->save();

        return response()->json($company->toClient());
    }
}
