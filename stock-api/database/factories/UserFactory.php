<?php

namespace Database\Factories;

use App\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => fn () => Company::create(['name' => fake()->company(), 'settings' => Company::DEFAULT_SETTINGS])->id,
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'password' => static::$password ??= Hash::make('password'),
            'role' => 'seller',
            'status' => 'actif',
            'remember_token' => Str::random(10),
        ];
    }

    /** Administrateur de son entreprise. */
    public function admin(): static
    {
        return $this->state(fn () => ['role' => 'admin']);
    }
}
