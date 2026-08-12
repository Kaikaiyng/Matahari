<?php

namespace Tests\Feature;

use Tests\TestCase;

class CorsConfigurationTest extends TestCase
{
    public function test_local_admin_and_app_origins_are_credential_enabled(): void
    {
        $origins = config('cors.allowed_origins');

        $this->assertContains('http://localhost:5173', $origins);
        $this->assertContains('http://127.0.0.1:5173', $origins);
        $this->assertContains('http://localhost:5174', $origins);
        $this->assertContains('http://127.0.0.1:5174', $origins);
        $this->assertTrue(config('cors.supports_credentials'));
    }
}
