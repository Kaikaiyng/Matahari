<?php

namespace Tests;

use App\Models\School;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Str;

abstract class TestCase extends BaseTestCase
{
    /** @param array<string, mixed> $attributes */
    protected function createTenantSchool(array $attributes): School
    {
        $code = (string) ($attributes['code'] ?? 'TEST');
        $tenant = Tenant::query()->create([
            'slug' => 'test-'.Str::lower(Str::random(16)),
            'name' => ($attributes['name'] ?? $code).' Tenant',
            'status' => 'active',
            'timezone' => 'Asia/Kuala_Lumpur',
            'locale' => 'en',
        ]);

        return School::query()->create(['tenant_id' => $tenant->id, ...$attributes]);
    }
}
