<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\SchoolSupportSetting;
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
            ->assertJsonPath('data.developer_name', 'Matahari')
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

    public function test_single_school_tenant_exposes_local_support_without_replacing_platform_safety_contacts(): void
    {
        $school = School::query()->where('code', 'MIS')->firstOrFail();
        SchoolSupportSetting::query()->create([
            'school_id' => $school->id,
            'call_phone' => '+60 12-345 6789',
            'whatsapp_phone' => '+60 12-345 6789',
            'support_email' => 'school-support@matahari.test',
            'operating_hours' => 'Monday - Friday, 8:00 AM - 5:00 PM',
        ]);

        $this->getJson('http://127.0.0.1/api/v1/public/community-policies/support')
            ->assertOk()
            ->assertJsonPath('data.support.email', 'support@example.test')
            ->assertJsonPath('data.support.child_safety_email', 'safety@example.test')
            ->assertJsonPath('data.support.school.call_phone', '+60 12-345 6789')
            ->assertJsonPath('data.support.school.support_email', 'school-support@matahari.test');
    }

    public function test_multi_school_tenant_does_not_guess_a_public_school_support_contact(): void
    {
        $school = School::query()->where('code', 'MIS')->firstOrFail();
        $second = School::query()->create([
            'tenant_id' => $school->tenant_id,
            'code' => 'MIS2',
            'name' => 'Matahari Second Campus',
            'receipt_prefix' => 'MIS2',
            'status' => 'active',
        ]);
        SchoolSupportSetting::query()->create(['school_id' => $school->id, 'support_email' => 'first@matahari.test']);
        SchoolSupportSetting::query()->create(['school_id' => $second->id, 'support_email' => 'second@matahari.test']);

        $this->getJson('http://127.0.0.1/api/v1/public/community-policies/support')
            ->assertOk()
            ->assertJsonPath('data.support.school', null)
            ->assertJsonMissing(['first@matahari.test', 'second@matahari.test']);
    }
}
