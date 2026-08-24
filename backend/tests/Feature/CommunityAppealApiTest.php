<?php

namespace Tests\Feature;

use App\Models\CommunityAppeal;
use App\Models\CommunityReport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommunityAppealApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_historical_appeals_remain_stored_but_active_appeal_routes_are_retired(): void
    {
        $teacher = $this->user('teacher.lim');
        $report = CommunityReport::query()->create([
            'tenant_id' => $teacher->school->tenant_id, 'school_id' => $teacher->school_id, 'reporter_user_id' => $teacher->id,
            'source' => 'submission', 'target_type' => 'post', 'reported_user_id' => $teacher->id, 'reason_code' => 'other',
            'priority' => 'normal', 'status' => CommunityReport::STATUS_RESOLVED, 'target_snapshot' => [], 'due_at' => now()->addDay(),
        ]);
        $action = $report->actions()->create([
            'tenant_id' => $teacher->school->tenant_id, 'school_id' => $teacher->school_id,
            'actor_user_id' => $this->user('admin')->id, 'action' => 'reject', 'reason_code' => 'other', 'reason' => 'Historical decision.',
        ]);
        $appeal = CommunityAppeal::query()->create([
            'tenant_id' => $teacher->school->tenant_id, 'school_id' => $teacher->school_id, 'community_report_id' => $report->id,
            'source_action_id' => $action->id, 'appellant_user_id' => $teacher->id, 'statement' => 'Historical appeal', 'status' => CommunityAppeal::STATUS_SUBMITTED,
        ]);

        $this->actingAs($teacher)->postJson('http://127.0.0.1/api/v1/community/appeals', ['report_id' => $report->id, 'statement' => 'New appeal'])->assertNotFound();
        $this->actingAs($teacher)->getJson('http://127.0.0.1/api/v1/community/appeals/mine')->assertNotFound();
        $this->actingAs($this->user('admin'))->postJson("http://localhost/api/v1/admin/community-moderation/appeals/{$appeal->id}/decision", [])->assertNotFound();

        $this->assertDatabaseHas('community_appeals', ['id' => $appeal->id, 'status' => CommunityAppeal::STATUS_SUBMITTED]);
    }

    private function user(string $username): User
    {
        return User::query()->where('username', $username)->firstOrFail();
    }
}
