<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicCommunityPolicyApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        config()->set('community_safety.support_email', 'support@example.test');
        config()->set('community_safety.child_safety_contact_email', 'safety@example.test');
    }

    public function test_effective_policy_is_public_and_contains_store_safety_disclosures(): void
    {
        $response = $this->getJson('http://127.0.0.1/api/v1/public/community-policies/child-safety')
            ->assertOk()
            ->assertJsonPath('data.slug', 'child-safety')
            ->assertJsonPath('data.developer_name', 'RYLAY')
            ->assertJsonPath('data.organization_name', 'Matahari International School')
            ->assertJsonPath('data.support.child_safety_email', 'safety@example.test');

        $text = json_encode($response->json('data'), JSON_THROW_ON_ERROR);
        $this->assertStringContainsString('child sexual abuse and exploitation (CSAE)', $text);
        $this->assertStringContainsString('CSAM', $text);
        $this->assertStringNotContainsString('reporter_user_id', $text);
        $this->assertStringNotContainsString('target_snapshot', $text);
    }

    public function test_unknown_public_policy_is_not_exposed(): void
    {
        $this->getJson('http://127.0.0.1/api/v1/public/community-policies/internal-case')->assertNotFound();
    }
}
