<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BootstrapController;
use App\Http\Controllers\CompanyController;
use App\Http\Controllers\DeviceController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\SyncController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Chaque requête authentifiée passe par le middleware « company » :
| l'utilisateur ne voit et ne modifie que les données de sa propre entreprise.
|
*/

// Vérification de connexion utilisée par le front : chaque réponse réussie
// redonne 30 jours d'utilisation hors ligne à l'application.
Route::get('/ping', function () {
    return response()->json(['ok' => true, 'time' => now()->toIso8601String()]);
});

Route::middleware('throttle:10,1')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);
});

Route::middleware(['auth:sanctum', 'company'])->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/me', [ProfileController::class, 'update']);
    Route::put('/me/password', [ProfileController::class, 'password']);

    Route::get('/company', [CompanyController::class, 'show']);
    Route::get('/users', [UserController::class, 'index']);
    Route::get('/bootstrap', BootstrapController::class);

    // Synchronisation entre appareils : file d'opérations envoyée, changements des autres reçus
    Route::post('/sync', [SyncController::class, 'sync']);
    Route::post('/devices', [DeviceController::class, 'store']);

    Route::put('/company/accounting', [CompanyController::class, 'updateAccounting'])->middleware('role:admin,accountant');

    Route::middleware('admin')->group(function () {
        Route::put('/company', [CompanyController::class, 'update']);
        Route::post('/users', [UserController::class, 'store']);
        Route::put('/users/{id}', [UserController::class, 'update']);
        Route::delete('/users/{id}', [UserController::class, 'destroy']);
    });
});
