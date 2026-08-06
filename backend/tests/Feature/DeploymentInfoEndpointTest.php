<?php

namespace Tests\Feature;

use Tests\TestCase;

class DeploymentInfoEndpointTest extends TestCase
{
    public function test_staging_exposes_only_the_safe_environment_label(): void
    {
        config(['deployment.mode' => 'staging']);

        $this->getJson('/api/deployment-info')
            ->assertOk()
            ->assertExactJson(['environment_label' => 'STAGING']);
    }

    public function test_prelaunch_production_exposes_the_demo_warning(): void
    {
        config(['deployment.mode' => 'prelaunch-production']);

        $this->getJson('/api/deployment-info')
            ->assertOk()
            ->assertExactJson(['environment_label' => 'PRE-LAUNCH DEMO']);
    }

    public function test_normal_production_exposes_no_label_or_configuration(): void
    {
        config(['deployment.mode' => 'production']);

        $response = $this->getJson('/api/deployment-info');

        $response->assertOk()->assertExactJson(['environment_label' => '']);
        $this->assertStringNotContainsString('APP_', $response->getContent());
        $this->assertStringNotContainsString('DB_', $response->getContent());
    }
}
