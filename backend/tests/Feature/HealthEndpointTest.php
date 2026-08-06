<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class HealthEndpointTest extends TestCase
{
    public function test_health_reports_ready_without_exposing_configuration(): void
    {
        $response = $this->getJson('/health');

        $response
            ->assertOk()
            ->assertExactJson(['status' => 'ok']);

        $this->assertStringNotContainsString('database', $response->getContent());
        $this->assertStringNotContainsString(base_path(), $response->getContent());
    }

    public function test_health_fails_closed_when_the_database_is_unavailable(): void
    {
        DB::shouldReceive('select')
            ->once()
            ->with('SELECT 1')
            ->andThrow(new RuntimeException('private failure detail'));

        $response = $this->getJson('/health');

        $response
            ->assertStatus(503)
            ->assertExactJson(['status' => 'unavailable']);

        $this->assertStringNotContainsString('private failure detail', $response->getContent());
    }
}
