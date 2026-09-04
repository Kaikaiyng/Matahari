<?php

namespace Tests;

use App\Models\School;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Str;

abstract class TestCase extends BaseTestCase
{
    public function createApplication()
    {
        $app = parent::createApplication();
        $connection = $app['db']->connection();

        // Check before RefreshDatabase / DatabaseMigrations can erase any tables.
        if ($connection->getDriverName() === 'pgsql') {
            if (env('MATAHARI_PGSQL_TEST_ALLOW_RESET') !== '1'
                || $connection->getConfig('url')
                || $connection->getDatabaseName() !== 'matahari_test'
                || $connection->selectOne('SELECT current_database() AS name')->name !== 'matahari_test') {
                throw new \RuntimeException('PostgreSQL tests require explicit MATAHARI_PGSQL_TEST_ALLOW_RESET=1, empty DB_URL, and the disposable matahari_test database.');
            }
        }

        return $app;
    }

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
