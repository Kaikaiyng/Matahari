<?php

namespace Tests\Feature;

use App\Models\CalendarEvent;
use App\Models\Permission;
use App\Models\Role;
use App\Models\School;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CalendarEventApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_school_user_can_create_list_update_and_delete_calendar_event(): void
    {
        $school = $this->school('MIS');
        $user = $this->userWithPermissions($school, [
            'calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete',
        ]);

        $create = $this->actingAs($user)->postJson('/api/calendar-events', [
            'school_id' => 999999,
            'created_by' => 999999,
            'updated_by' => 999999,
            'title' => 'Parent Appointment',
            'event_type' => 'appointment',
            'is_all_day' => false,
            'starts_at' => '2026-07-21T09:00:00+08:00',
            'ends_at' => '2026-07-21T10:00:00+08:00',
            'location' => 'Meeting Room',
            'participants' => 'Michelle Tan, School Admin',
            'notes' => 'Admission discussion',
        ])->assertCreated()
            ->assertJsonPath('calendar_event.school_id', $school->id)
            ->assertJsonPath('calendar_event.created_by.id', $user->id);

        $eventId = $create->json('calendar_event.id');

        $this->actingAs($user)
            ->getJson('/api/calendar-events?start=2026-07-01&end=2026-07-31')
            ->assertOk()->assertJsonPath('data.0.id', $eventId);

        $this->actingAs($user)->patchJson("/api/calendar-events/{$eventId}", [
            'created_by' => 999999,
            'updated_by' => 999999,
            'title' => 'Updated Parent Appointment',
            'event_type' => 'appointment',
            'is_all_day' => false,
            'starts_at' => '2026-07-21T09:30:00+08:00',
            'ends_at' => '2026-07-21T10:30:00+08:00',
        ])->assertOk()
            ->assertJsonPath('calendar_event.title', 'Updated Parent Appointment')
            ->assertJsonPath('calendar_event.updated_by.id', $user->id);

        $this->actingAs($user)->deleteJson("/api/calendar-events/{$eventId}")->assertNoContent();
        $this->assertDatabaseMissing('calendar_events', ['id' => $eventId]);
    }

    public function test_create_normalizes_offset_datetimes_to_the_correct_utc_instant(): void
    {
        $school = $this->school('MIS');
        $user = $this->userWithPermissions($school, ['calendar.create']);

        $response = $this->actingAs($user)
            ->postJson('/api/calendar-events', $this->validEventPayload())
            ->assertCreated()
            ->assertJsonPath('calendar_event.created_by.id', $user->id)
            ->assertJsonPath('calendar_event.updated_by.id', $user->id)
            ->assertJsonPath('calendar_event.starts_at', '2026-07-21T01:00:00.000000Z')
            ->assertJsonPath('calendar_event.ends_at', '2026-07-21T02:00:00.000000Z');

        $event = CalendarEvent::query()->findOrFail($response->json('calendar_event.id'));

        $this->assertSame('2026-07-21 01:00:00', $event->getRawOriginal('starts_at'));
        $this->assertSame('2026-07-21 02:00:00', $event->getRawOriginal('ends_at'));
    }

    public function test_update_normalizes_offset_datetimes_without_changing_creator(): void
    {
        $school = $this->school('MIS');
        $creator = User::factory()->create(['school_id' => $school->id]);
        $updater = $this->userWithPermissions($school, ['calendar.update']);
        $event = $this->event($school, [
            'created_by' => $creator->id,
            'updated_by' => $creator->id,
        ]);

        $this->actingAs($updater)
            ->patchJson("/api/calendar-events/{$event->id}", $this->validEventPayload())
            ->assertOk()
            ->assertJsonPath('calendar_event.created_by.id', $creator->id)
            ->assertJsonPath('calendar_event.updated_by.id', $updater->id)
            ->assertJsonPath('calendar_event.starts_at', '2026-07-21T01:00:00.000000Z')
            ->assertJsonPath('calendar_event.ends_at', '2026-07-21T02:00:00.000000Z');

        $event->refresh();

        $this->assertSame('2026-07-21 01:00:00', $event->getRawOriginal('starts_at'));
        $this->assertSame('2026-07-21 02:00:00', $event->getRawOriginal('ends_at'));
        $this->assertSame($creator->id, $event->created_by);
        $this->assertSame($updater->id, $event->updated_by);
    }

    public function test_range_query_includes_events_that_overlap_the_boundary(): void
    {
        $school = $this->school('MIS');
        $user = $this->userWithPermissions($school, ['calendar.view']);
        $event = $this->event($school, [
            'title' => 'Overnight Event',
            'starts_at' => '2026-07-20 23:00:00',
            'ends_at' => '2026-07-21 01:00:00',
        ]);

        $this->actingAs($user)
            ->getJson('/api/calendar-events?start=2026-07-21&end=2026-07-21')
            ->assertOk()
            ->assertJsonPath('data.0.id', $event->id);
    }

    public function test_calendar_list_returns_only_active_staff_from_the_current_school(): void
    {
        $school = $this->school('MIS');
        $otherSchool = $this->school('OTH');
        $user = $this->userWithPermissions($school, ['calendar.view']);
        $activeStaff = User::factory()->create([
            'school_id' => $school->id,
            'name' => 'Active Staff',
            'status' => 'active',
        ]);
        User::factory()->create([
            'school_id' => $school->id,
            'name' => 'Inactive Staff',
            'status' => 'inactive',
        ]);
        User::factory()->create([
            'school_id' => $otherSchool->id,
            'name' => 'Other School Staff',
            'status' => 'active',
        ]);

        $this->actingAs($user)
            ->getJson('/api/calendar-events?start=2026-07-01&end=2026-07-31')
            ->assertOk()
            ->assertJsonFragment([
                'id' => $activeStaff->id,
                'name' => 'Active Staff',
                'username' => $activeStaff->username,
            ])
            ->assertJsonMissing(['name' => 'Inactive Staff'])
            ->assertJsonMissing(['name' => 'Other School Staff']);
    }

    public function test_school_user_cannot_view_update_or_delete_another_schools_event(): void
    {
        $school = $this->school('MIS');
        $otherSchool = $this->school('OTH');
        $user = $this->userWithPermissions($school, ['calendar.view', 'calendar.update', 'calendar.delete']);
        $event = $this->event($otherSchool);

        $this->actingAs($user)
            ->getJson('/api/calendar-events?start=2026-07-01&end=2026-07-31&school_id='.$otherSchool->id)
            ->assertOk()
            ->assertJsonCount(0, 'data');
        $this->actingAs($user)->patchJson("/api/calendar-events/{$event->id}", $this->validEventPayload())
            ->assertNotFound();
        $this->actingAs($user)->deleteJson("/api/calendar-events/{$event->id}")
            ->assertNotFound();
    }

    public function test_group_user_must_supply_a_valid_active_school_context(): void
    {
        $school = $this->school('MIS');
        $inactiveSchool = $this->school('OLD', 'inactive');
        $user = $this->userWithPermissions(null, ['calendar.view', 'calendar.create']);

        $this->actingAs($user)
            ->getJson('/api/calendar-events?start=2026-07-01&end=2026-07-31')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('school_id');
        $this->actingAs($user)
            ->getJson('/api/calendar-events?start=2026-07-01&end=2026-07-31&school_id='.$inactiveSchool->id)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('school_id');
        $this->actingAs($user)
            ->postJson('/api/calendar-events', [...$this->validEventPayload(), 'school_id' => $school->id])
            ->assertCreated()
            ->assertJsonPath('calendar_event.school_id', $school->id);
    }

    public function test_calendar_event_rejects_invalid_type_missing_title_and_end_before_start(): void
    {
        $school = $this->school('MIS');
        $user = $this->userWithPermissions($school, ['calendar.create']);

        $this->actingAs($user)->postJson('/api/calendar-events', [
            ...$this->validEventPayload(),
            'title' => '',
            'event_type' => 'exam',
            'starts_at' => '2026-07-21T10:00:00+08:00',
            'ends_at' => '2026-07-21T09:00:00+08:00',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['title', 'event_type', 'ends_at']);
    }

    public function test_calendar_routes_require_the_matching_permission(): void
    {
        $school = $this->school('MIS');
        $user = $this->userWithPermissions($school, ['calendar.view']);
        $event = $this->event($school);

        $this->actingAs($user)
            ->getJson('/api/calendar-events?start=2026-07-01&end=2026-07-31')
            ->assertOk();
        $this->actingAs($user)->postJson('/api/calendar-events', $this->validEventPayload())->assertForbidden();
        $this->actingAs($user)->patchJson("/api/calendar-events/{$event->id}", $this->validEventPayload())->assertForbidden();
        $this->actingAs($user)->deleteJson("/api/calendar-events/{$event->id}")->assertForbidden();
    }

    public function test_initial_roles_have_the_approved_calendar_permission_matrix(): void
    {
        $this->seed();

        $expected = [
            'super-admin' => ['calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete'],
            'ceo' => ['calendar.view'],
            'school-admin' => ['calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete'],
            'finance' => ['calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete'],
        ];

        foreach ($expected as $roleSlug => $expectedCalendarPermissions) {
            $actual = Role::query()
                ->where('slug', $roleSlug)
                ->firstOrFail()
                ->permissions()
                ->whereIn('slug', ['calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete'])
                ->pluck('slug')
                ->sort()
                ->values()
                ->all();

            sort($expectedCalendarPermissions);
            $this->assertSame($expectedCalendarPermissions, $actual, "Unexpected calendar permissions for {$roleSlug}");
        }
    }

    public function test_calendar_event_casts_all_day_and_date_fields(): void
    {
        $school = $this->school('MIS');
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

    private function school(string $code, string $status = 'active'): School
    {
        return School::query()->create([
            'code' => $code,
            'name' => $code.' School',
            'receipt_prefix' => $code,
            'invoice_prefix' => $code.'-INV',
            'status' => $status,
        ]);
    }

    /** @param array<string, mixed> $attributes */
    private function event(School $school, array $attributes = []): CalendarEvent
    {
        return CalendarEvent::query()->create([
            'school_id' => $school->id,
            'title' => 'School Event',
            'event_type' => 'meeting',
            'is_all_day' => false,
            'starts_at' => '2026-07-21 09:00:00',
            'ends_at' => '2026-07-21 10:00:00',
            ...$attributes,
        ]);
    }

    /** @return array<string, mixed> */
    private function validEventPayload(): array
    {
        return [
            'title' => 'School Event',
            'event_type' => 'meeting',
            'is_all_day' => false,
            'starts_at' => '2026-07-21T09:00:00+08:00',
            'ends_at' => '2026-07-21T10:00:00+08:00',
        ];
    }

    /** @param array<int, string> $permissionSlugs */
    private function userWithPermissions(?School $school, array $permissionSlugs): User
    {
        $user = User::factory()->create(['school_id' => $school?->id]);
        $role = Role::query()->create(['name' => 'Calendar Role', 'slug' => 'calendar-role-'.uniqid()]);

        foreach ($permissionSlugs as $permissionSlug) {
            $permission = Permission::query()->firstOrCreate(
                ['slug' => $permissionSlug],
                ['name' => $permissionSlug],
            );
            $role->permissions()->syncWithoutDetaching([$permission->id]);
        }

        $user->roles()->syncWithoutDetaching([$role->id]);

        return $user;
    }
}
