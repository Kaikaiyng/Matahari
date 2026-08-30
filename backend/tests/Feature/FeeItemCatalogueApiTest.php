<?php

namespace Tests\Feature;

use App\Contracts\AuditLoggerContract;
use App\Models\FeeItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

class FeeItemCatalogueApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_finance_can_create_and_update_fee_items_with_audit_history(): void
    {
        $this->seed();
        $finance = User::query()->where('username', 'finance')->firstOrFail();

        $created = $this->actingAs($finance)->postJson('http://localhost/api/fee-items', [
            'name' => 'Uniform',
            'code' => 'uniform',
            'category' => 'optional',
            'fee_type' => 'one_time',
            'default_amount' => '125.50',
        ])->assertCreated()
            ->assertJsonPath('data.code', 'UNIFORM')
            ->assertJsonPath('data.status', 'active');

        $feeItemId = $created->json('data.id');

        $this->actingAs($finance)->patchJson("http://localhost/api/fee-items/{$feeItemId}", [
            'name' => 'School Uniform',
            'category' => 'optional',
            'fee_type' => 'one_time',
            'default_amount' => '130.00',
            'status' => 'inactive',
        ])->assertOk()
            ->assertJsonPath('data.name', 'School Uniform')
            ->assertJsonPath('data.code', 'UNIFORM')
            ->assertJsonPath('data.status', 'inactive');

        $this->assertDatabaseHas('fee_items', ['id' => $feeItemId, 'default_amount' => 130, 'status' => 'inactive']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'fee_item.created', 'entity_id' => (string) $feeItemId]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'fee_item.updated', 'entity_id' => (string) $feeItemId]);
    }

    public function test_catalogue_lists_inactive_items_without_exposing_them_to_agreement_editor(): void
    {
        $this->seed();
        $finance = User::query()->where('username', 'finance')->firstOrFail();
        $inactive = FeeItem::query()->where('school_id', $finance->school_id)->where('code', 'TRANSPORT')->firstOrFail();
        $inactive->update(['status' => 'inactive']);

        $this->actingAs($finance)->getJson('http://localhost/api/fee-items/catalogue')
            ->assertOk()
            ->assertJsonFragment(['code' => 'TRANSPORT', 'status' => 'inactive']);

        $this->actingAs($finance)->getJson('http://localhost/api/fee-items')
            ->assertOk()
            ->assertJsonMissing(['code' => 'TRANSPORT']);
    }

    public function test_view_only_admin_cannot_mutate_fee_items(): void
    {
        $this->seed();
        $admin = User::query()->where('username', 'admin')->firstOrFail();

        $this->actingAs($admin)->postJson('http://localhost/api/fee-items', [
            'name' => 'Unauthorized',
            'code' => 'NOPE',
            'category' => 'optional',
            'fee_type' => 'one_time',
            'default_amount' => 10,
        ])->assertForbidden();
    }

    public function test_required_foundation_items_cannot_be_deactivated(): void
    {
        $this->seed();
        $finance = User::query()->where('username', 'finance')->firstOrFail();
        $tuition = FeeItem::query()->where('school_id', $finance->school_id)->where('code', 'TUITION')->firstOrFail();

        $this->actingAs($finance)->patchJson("http://localhost/api/fee-items/{$tuition->id}", [
            'name' => $tuition->name,
            'category' => 'mandatory',
            'fee_type' => 'recurring',
            'default_amount' => $tuition->default_amount,
            'status' => 'inactive',
        ])->assertUnprocessable()->assertJsonValidationErrors('status');

        $this->assertDatabaseHas('fee_items', ['id' => $tuition->id, 'status' => 'active']);
    }

    public function test_fee_item_mutation_rolls_back_when_audit_persistence_fails(): void
    {
        $this->seed();
        $finance = User::query()->where('username', 'finance')->firstOrFail();
        $this->mock(AuditLoggerContract::class)->shouldReceive('record')->once()->andThrow(new RuntimeException('audit unavailable'));

        $this->actingAs($finance)->postJson('http://localhost/api/fee-items', [
            'name' => 'Rollback Item',
            'code' => 'ROLLBACK',
            'category' => 'optional',
            'fee_type' => 'one_time',
            'default_amount' => 10,
        ])->assertServerError();

        $this->assertDatabaseMissing('fee_items', ['code' => 'ROLLBACK']);
    }
}
