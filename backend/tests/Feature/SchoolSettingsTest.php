<?php

namespace Tests\Feature;

use App\Contracts\AuditLoggerContract;
use App\Models\Role;
use App\Models\SchoolSupportSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

class SchoolSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_school_information_support_schema_and_default_permissions_are_available(): void
    {
        $this->seed();

        $this->assertTrue(Schema::hasColumns('schools', [
            'registration_number',
            'group_member_line',
            'operating_hours',
        ]));
        $this->assertTrue(Schema::hasColumns('school_support_settings', [
            'school_id',
            'call_phone',
            'whatsapp_phone',
            'support_email',
            'operating_hours',
            'updated_by',
        ]));

        foreach (['super-admin', 'school-admin', 'finance'] as $roleSlug) {
            $this->assertTrue(
                Role::query()->where('slug', $roleSlug)->firstOrFail()->permissions()->where('slug', 'school.settings.manage')->exists(),
                "{$roleSlug} should receive school.settings.manage.",
            );
        }

        $this->assertFalse(
            Role::query()->where('slug', 'teacher')->firstOrFail()->permissions()->where('slug', 'school.settings.manage')->exists(),
        );
    }

    public function test_school_admin_can_read_and_update_current_school_settings_with_audit_history(): void
    {
        $this->seed();
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $school = $admin->school;

        $this->actingAs($admin)->getJson('http://localhost/api/v1/admin/settings/school-information')
            ->assertOk()
            ->assertJsonPath('data.name', 'Matahari International School');

        $this->actingAs($admin)->putJson('http://localhost/api/v1/admin/settings/school-information', [
            'name' => 'Matahari International School',
            'registration_number' => 'MIS-2026-01',
            'group_member_line' => 'A member of Matahari Education Group',
            'address' => 'Johor Bahru, Johor',
            'phone' => '+60 7-123 4567',
            'email' => 'office@matahari.test',
            'operating_hours' => 'Monday - Friday, 8:00 AM - 5:00 PM',
        ])->assertOk()->assertJsonPath('data.registration_number', 'MIS-2026-01');

        $this->actingAs($admin)->putJson('http://localhost/api/v1/admin/settings/app-support', [
            'call_phone' => '+60 12-345 6789',
            'whatsapp_phone' => '+60 12-345 6789',
            'support_email' => 'support@matahari.test',
            'operating_hours' => 'Monday - Friday, 8:00 AM - 5:00 PM',
        ])->assertOk()->assertJsonPath('data.support_email', 'support@matahari.test');

        $this->assertDatabaseHas('schools', ['id' => $school->id, 'registration_number' => 'MIS-2026-01']);
        $this->assertDatabaseHas('school_support_settings', ['school_id' => $school->id, 'updated_by' => $admin->id]);
        $this->assertDatabaseHas('audit_logs', ['school_id' => $school->id, 'action' => 'school.information_updated']);
        $this->assertDatabaseHas('audit_logs', ['school_id' => $school->id, 'action' => 'school.app_support_updated']);
    }

    public function test_teacher_cannot_update_school_settings_and_invalid_email_is_rejected(): void
    {
        $this->seed();
        $teacher = User::query()->where('username', 'teacher.lim')->firstOrFail();
        $admin = User::query()->where('username', 'admin')->firstOrFail();

        $this->actingAs($teacher)->putJson('http://localhost/api/v1/admin/settings/school-information', [
            'name' => 'Unauthorized Rename',
        ])->assertForbidden();

        $this->actingAs($admin)->putJson('http://localhost/api/v1/admin/settings/app-support', [
            'support_email' => 'not-an-email',
        ])->assertUnprocessable()->assertJsonValidationErrors('support_email');
    }

    public function test_app_support_update_rolls_back_when_audit_persistence_fails(): void
    {
        $this->seed();
        $admin = User::query()->where('username', 'admin')->firstOrFail();
        $this->mock(AuditLoggerContract::class)->shouldReceive('record')->once()->andThrow(new RuntimeException('audit unavailable'));

        $this->actingAs($admin)->putJson('http://localhost/api/v1/admin/settings/app-support', [
            'call_phone' => '+60 11-111 1111',
        ])->assertServerError();

        $this->assertFalse(SchoolSupportSetting::query()->where('school_id', $admin->school_id)->exists());
    }
}
