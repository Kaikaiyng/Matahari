<?php

namespace Tests\Feature;

use App\Models\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
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
}
