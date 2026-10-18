<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/** Conversion entre les lignes SQL (snake_case) et les objets du store du front (camelCase). */
class ClientFormat
{
    /** Champs texte que le front attend en chaîne vide plutôt qu'à null */
    private const TEXT_FIELDS = ['image', 'description', 'notes', 'note', 'email', 'phone', 'city', 'contact', 'category', 'address', 'model', 'info', 'technician', 'assignedTo', 'reference', 'userName', 'sku', 'supplierId'];

    /** Ligne SQL -> objet du front : camelCase, sans company_id ni updated_at. */
    public static function row(Model $model, array $except = []): array
    {
        $out = [];
        foreach (Arr::except($model->toArray(), ['company_id', 'updated_at', ...$except]) as $key => $value) {
            $key = Str::camel($key);
            $out[$key] = $value === null && in_array($key, self::TEXT_FIELDS, true) ? '' : $value;
        }

        return $out;
    }

    public static function rows(Collection $models, array $except = []): array
    {
        return $models->map(fn (Model $model) => self::row($model, $except))->values()->all();
    }

    /** Objet du front -> colonnes SQL, limité aux champs autorisés (camelCase). */
    public static function toColumns(array $data, array $allowed): array
    {
        $columns = [];
        foreach (Arr::only($data, $allowed) as $key => $value) {
            $columns[Str::snake($key)] = $value;
        }

        return $columns;
    }
}
