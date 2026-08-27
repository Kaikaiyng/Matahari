<?php

namespace Tests\Feature;

use App\Models\NotificationDestination;
use App\Models\PortalNotification;
use App\Models\User;
use App\Services\Notifications\NotificationDispatcher;
use App\Services\Notifications\NotificationMessage;
use App\Services\Notifications\NotificationTarget;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use InvalidArgumentException;
use RuntimeException;
use Tests\TestCase;

class NotificationChannelArchitectureTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_destination_schema_and_exact_hierarchy_scopes_are_channel_neutral(): void
    {
        $school = User::query()->where('username', 'admin')->firstOrFail()->school()->firstOrFail();
        $otherSchool = $this->createTenantSchool([
            'code' => 'OTHER',
            'name' => 'Other School',
            'receipt_prefix' => 'OTH',
            'invoice_prefix' => 'OTH',
        ]);

        $global = $this->destination(null, null, 'global-ops');
        $tenant = $this->destination((int) $school->tenant_id, null, 'tenant-admin');
        $schoolDestination = $this->destination((int) $school->tenant_id, (int) $school->id, 'school-admin');
        $this->destination((int) $otherSchool->tenant_id, null, 'other-tenant');
        $inactive = $this->destination((int) $school->tenant_id, null, 'inactive', 'inactive');

        $this->assertTrue(Schema::hasColumns('notification_destinations', [
            'tenant_id', 'school_id', 'channel', 'destination_type', 'destination_address',
            'purpose', 'configuration', 'status',
        ]));
        $this->assertSame([$global->id], NotificationDestination::query()->forScope(null, null)->pluck('id')->all());
        $this->assertSame(
            [$tenant->id, $inactive->id],
            NotificationDestination::query()->forScope((int) $school->tenant_id, null)->orderBy('id')->pluck('id')->all(),
        );
        $this->assertSame(
            [$schoolDestination->id],
            NotificationDestination::query()->forScope((int) $school->tenant_id, (int) $school->id)->pluck('id')->all(),
        );
        $this->assertSame(
            [$tenant->id],
            NotificationDestination::query()->forScope((int) $school->tenant_id, null)->active()->pluck('id')->all(),
        );
        $this->assertSame('webhook', $tenant->channel);
        $this->assertSame('group', $tenant->destination_type);
    }

    public function test_destination_rejects_school_without_tenant_and_cross_tenant_school(): void
    {
        $school = User::query()->where('username', 'admin')->firstOrFail()->school()->firstOrFail();
        $otherSchool = $this->createTenantSchool([
            'code' => 'CROSS',
            'name' => 'Cross Tenant School',
            'receipt_prefix' => 'CTS',
            'invoice_prefix' => 'CTS',
        ]);

        try {
            $this->destination(null, (int) $school->id, 'invalid-school-only');
            $this->fail('A school destination without a tenant should be rejected.');
        } catch (InvalidArgumentException $exception) {
            $this->assertSame('A school-scoped notification destination requires a tenant.', $exception->getMessage());
        }

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('The notification destination school does not belong to the selected tenant.');
        $this->destination((int) $school->tenant_id, (int) $otherSchool->id, 'cross-tenant');
    }

    public function test_dispatcher_delivers_in_app_and_skips_an_unregistered_external_channel(): void
    {
        $user = User::query()->where('username', 'rachel.wong')->firstOrFail();
        $school = $user->school()->firstOrFail();
        $message = new NotificationMessage(
            tenantId: (int) $school->tenant_id,
            schoolId: (int) $school->id,
            type: 'general',
            title: 'Channel test',
            body: 'The in-app channel remains active.',
            context: ['source' => 'test'],
        );
        $dispatcher = app(NotificationDispatcher::class);

        $delivered = $dispatcher->sendInApp($message, [$user->id]);
        $skipped = $dispatcher->dispatch($message, 'webhook', [new NotificationTarget('webhook', 'group', 'ops-room')]);

        $this->assertSame(1, $delivered->delivered);
        $this->assertSame(0, $delivered->skipped);
        $this->assertSame(0, $skipped->delivered);
        $this->assertSame(1, $skipped->skipped);
        $this->assertDatabaseHas('portal_notifications', [
            'school_id' => $school->id,
            'recipient_user_id' => $user->id,
            'type' => 'general',
            'title' => 'Channel test',
        ]);
        $this->assertSame(['source' => 'test'], PortalNotification::query()->where('title', 'Channel test')->firstOrFail()->context_json);
    }

    public function test_in_app_delivery_keeps_the_calling_transaction_boundary(): void
    {
        $user = User::query()->where('username', 'rachel.wong')->firstOrFail();
        $school = $user->school()->firstOrFail();

        try {
            DB::transaction(function () use ($user, $school): void {
                app(NotificationDispatcher::class)->sendInApp(new NotificationMessage(
                    tenantId: (int) $school->tenant_id,
                    schoolId: (int) $school->id,
                    type: 'general',
                    title: 'Rollback test',
                    body: 'This record must roll back.',
                ), [$user->id]);
                throw new RuntimeException('Force rollback.');
            });
        } catch (RuntimeException $exception) {
            $this->assertSame('Force rollback.', $exception->getMessage());
        }

        $this->assertDatabaseMissing('portal_notifications', ['title' => 'Rollback test']);
    }

    private function destination(?int $tenantId, ?int $schoolId, string $address, string $status = 'active'): NotificationDestination
    {
        return NotificationDestination::query()->create([
            'tenant_id' => $tenantId,
            'school_id' => $schoolId,
            'channel' => 'webhook',
            'destination_type' => 'group',
            'destination_address' => $address,
            'purpose' => 'technical_alert',
            'configuration' => ['format' => 'compact'],
            'status' => $status,
        ]);
    }
}
