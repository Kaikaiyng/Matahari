<?php

namespace Tests\Feature;

use App\Models\CalendarEvent;
use App\Models\Role;
use App\Models\School;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CalendarEventApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_initial_role_has_calendar_crud_permissions(): void
    {
        $this->seed();

        foreach (['super-admin', 'ceo', 'school-admin', 'finance'] as $roleSlug) {
            $permissionSlugs = Role::query()->where('slug', $roleSlug)->firstOrFail()
                ->permissions()->pluck('slug')->all();

            $this->assertEqualsCanonicalizing([
                'calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete',
            ], array_values(array_intersect($permissionSlugs, [
                'calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete',
            ])));
        }
    }

    public function test_calendar_event_casts_all_day_and_date_fields(): void
    {
        $school = School::query()->create([
            'code' => 'MIS',
            'name' => 'Matahari International School',
            'receipt_prefix' => 'MIS',
            'invoice_prefix' => 'MIS-INV',
            'status' => 'active',
        ]);
        $user = User::factory()->create(['school_id' => $school->id]);
        $event = CalendarEvent::query()->create([
            'school_id' => $school->id,
            'title' => 'Staff Training',
            'event_type' => 'training',
            'is_all_day' => true,
            'starts_at' => '2026-07-21 00:00:00',
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        $this->assertTrue($event->is_all_day);
        $this->assertSame('2026-07-21', $event->starts_at->toDateString());
    }
}
