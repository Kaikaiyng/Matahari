<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SchoolClass;
use App\Support\SchoolClassCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class SchoolClassController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $schoolId = $request->user()?->school_id ?: $request->integer('school_id');

        if (! $schoolId) {
            throw ValidationException::withMessages(['school_id' => 'School is required.']);
        }

        $classesByName = SchoolClass::query()
            ->where('school_id', $schoolId)
            ->where('status', 'active')
            ->whereIn('name', SchoolClassCatalog::names())
            ->get()
            ->keyBy('name');

        $classes = collect(SchoolClassCatalog::groups())
            ->flatMap(fn (array $names, string $levelGroup) => collect($names)
                ->map(function (string $name) use ($classesByName, $levelGroup): ?array {
                    $schoolClass = $classesByName->get($name);

                    return $schoolClass ? [
                        'id' => $schoolClass->id,
                        'name' => $schoolClass->name,
                        'level_group' => $levelGroup,
                    ] : null;
                })
                ->filter())
            ->values();

        return response()->json(['data' => $classes]);
    }
}
