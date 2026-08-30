<?php

namespace App\Services\FeeItems;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\FeeItem;
use Illuminate\Support\Facades\DB;

final class FeeItemService
{
    private const AUDIT_FIELDS = ['name', 'code', 'category', 'fee_type', 'default_amount', 'status'];

    public function __construct(private readonly AuditLoggerContract $auditLogger) {}

    /** @param array<string, mixed> $data */
    public function create(int $schoolId, array $data, AuditContext $context): FeeItem
    {
        return DB::transaction(function () use ($schoolId, $data, $context): FeeItem {
            $item = FeeItem::query()->create([...$data, 'school_id' => $schoolId, 'status' => 'active']);

            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::FeeItemCreated,
                module: AuditModule::FeeAgreements,
                schoolId: $schoolId,
                subjectType: AuditSubject::FeeItem,
                subjectId: $item->id,
                newValues: $item->only(self::AUDIT_FIELDS),
                reason: 'Fee catalogue item created.',
            ), $context);

            return $item;
        });
    }

    /** @param array<string, mixed> $data */
    public function update(int $schoolId, FeeItem $item, array $data, AuditContext $context): FeeItem
    {
        abort_unless((int) $item->school_id === $schoolId, 404);

        return DB::transaction(function () use ($item, $data, $context, $schoolId): FeeItem {
            $locked = FeeItem::query()->whereKey($item->id)->where('school_id', $schoolId)->lockForUpdate()->firstOrFail();
            $before = $locked->only(self::AUDIT_FIELDS);
            $locked->update($data);
            $after = $locked->fresh();

            $this->auditLogger->record(new AuditEvent(
                action: AuditAction::FeeItemUpdated,
                module: AuditModule::FeeAgreements,
                schoolId: $schoolId,
                subjectType: AuditSubject::FeeItem,
                subjectId: $locked->id,
                oldValues: $before,
                newValues: $after->only(self::AUDIT_FIELDS),
                reason: $data['status'] === 'inactive' ? 'Fee catalogue item deactivated.' : 'Fee catalogue item updated.',
            ), $context);

            return $after;
        });
    }
}
