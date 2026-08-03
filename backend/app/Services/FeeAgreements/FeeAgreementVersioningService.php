<?php

namespace App\Services\FeeAgreements;

use App\Models\FeeAgreement;
use App\Models\FeeAgreementDiscount;
use App\Models\FeeAgreementItem;
use App\Models\FeeItem;
use App\Models\Student;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class FeeAgreementVersioningService
{
    /**
     * @param array<string, mixed> $data
     */
    public function createCurrent(Student $student, array $data, ?int $userId = null): FeeAgreement
    {
        return DB::transaction(function () use ($student, $data, $userId): FeeAgreement {
            $existingCurrent = FeeAgreement::query()
                ->where('school_id', $student->school_id)
                ->where('student_id', $student->id)
                ->where('academic_year', $data['academic_year'])
                ->where('is_current', true)
                ->lockForUpdate()
                ->exists();

            if ($existingCurrent) {
                throw ValidationException::withMessages([
                    'academic_year' => 'This student already has a current Fee Agreement for the academic year.',
                ]);
            }

            $versionNo = ((int) FeeAgreement::query()
                ->where('school_id', $student->school_id)
                ->where('student_id', $student->id)
                ->where('academic_year', $data['academic_year'])
                ->lockForUpdate()
                ->max('version_no')) + 1;

            $agreement = FeeAgreement::query()->create([
                'school_id' => $student->school_id,
                'student_id' => $student->id,
                'academic_year' => $data['academic_year'],
                'version_no' => $versionNo,
                'payment_plan' => $data['payment_plan'],
                'effective_from' => $data['effective_from'],
                'effective_to' => $data['effective_to'] ?? null,
                'is_current' => true,
                'current_slot' => 1,
                'status' => 'active',
                'remarks' => $data['remarks'] ?? null,
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);

            $this->snapshotItemsAndDiscounts($agreement, $data, $userId);

            return $agreement->load(['student', 'items', 'discounts.selectedItems']);
        });
    }

    /**
     * @param array<string, mixed> $data
     */
    public function supersede(FeeAgreement $currentAgreement, array $data, ?int $userId = null): FeeAgreement
    {
        return DB::transaction(function () use ($currentAgreement, $data, $userId): FeeAgreement {
            /** @var FeeAgreement $lockedCurrent */
            $lockedCurrent = FeeAgreement::query()
                ->whereKey($currentAgreement->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! $lockedCurrent->is_current || $lockedCurrent->status !== 'active') {
                throw ValidationException::withMessages([
                    'fee_agreement' => 'Only active current Fee Agreements can be superseded.',
                ]);
            }

            $newEffectiveFrom = Carbon::parse($data['effective_from']);
            $newEffectiveMonth = $newEffectiveFrom->copy()->startOfMonth()->format('Y-m');
            $hasChargeHistory = $lockedCurrent->feeRecordCharges()
                ->where('billing_month', '>=', $newEffectiveMonth)
                ->lockForUpdate()
                ->exists();

            if ($hasChargeHistory) {
                throw new HttpException(
                    409,
                    'Fee Agreement cannot be superseded while charge history exists on or after the new effective month.',
                );
            }

            $lockedCurrent->update([
                'effective_to' => $newEffectiveFrom->copy()->subDay()->toDateString(),
                'is_current' => false,
                'current_slot' => null,
                'status' => 'superseded',
                'updated_by' => $userId,
            ]);

            FeeAgreement::query()
                ->where('school_id', $lockedCurrent->school_id)
                ->where('student_id', $lockedCurrent->student_id)
                ->where('academic_year', $lockedCurrent->academic_year)
                ->where('id', '!=', $lockedCurrent->id)
                ->where('is_current', true)
                ->lockForUpdate()
                ->update([
                    'is_current' => false,
                    'current_slot' => null,
                    'status' => 'superseded',
                    'updated_by' => $userId,
                ]);

            $newAgreement = FeeAgreement::query()->create([
                'school_id' => $lockedCurrent->school_id,
                'student_id' => $lockedCurrent->student_id,
                'academic_year' => $lockedCurrent->academic_year,
                'version_no' => $lockedCurrent->version_no + 1,
                'payment_plan' => $data['payment_plan'] ?? $lockedCurrent->payment_plan,
                'effective_from' => $data['effective_from'],
                'effective_to' => $data['effective_to'] ?? null,
                'is_current' => true,
                'current_slot' => 1,
                'status' => 'active',
                'remarks' => $data['remarks'] ?? null,
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);

            $this->snapshotItemsAndDiscounts($newAgreement, $data, $userId);

            return $newAgreement->load(['student', 'items', 'discounts.selectedItems']);
        });
    }

    /**
     * @param array<string, mixed> $data
     */
    private function snapshotItemsAndDiscounts(FeeAgreement $agreement, array $data, ?int $userId): void
    {
        $submittedItemIds = collect($data['items'])
            ->pluck('fee_item_id')
            ->map(fn ($id) => (int) $id)
            ->values();
        $uniqueItemIds = $submittedItemIds->unique()->values();

        if ($submittedItemIds->count() !== $uniqueItemIds->count()) {
            throw ValidationException::withMessages([
                'items' => 'Fee items must not be duplicated.',
            ]);
        }

        $feeItems = FeeItem::query()
            ->where('school_id', $agreement->school_id)
            ->whereIn('id', $uniqueItemIds->all())
            ->get()
            ->keyBy('id');

        if ($feeItems->count() !== $uniqueItemIds->count()) {
            throw ValidationException::withMessages([
                'items' => 'Every fee item must belong to the agreement school.',
            ]);
        }

        $agreementItemsByCode = collect();

        foreach (array_values($data['items']) as $index => $itemData) {
            /** @var FeeItem $feeItem */
            $feeItem = $feeItems->get($itemData['fee_item_id']);
            $description = $feeItem->code === 'OTHERS'
                ? $itemData['description']
                : ($itemData['description'] ?? $feeItem->name);

            $agreementItem = FeeAgreementItem::query()->create([
                'school_id' => $agreement->school_id,
                'fee_agreement_id' => $agreement->id,
                'fee_item_id' => $feeItem->id,
                'fee_code' => $feeItem->code,
                'fee_category' => $feeItem->category,
                'description' => $description,
                'amount' => $itemData['amount'],
                'is_mandatory' => in_array($feeItem->code, ['TUITION', 'MISC'], true) || $feeItem->category === 'mandatory',
                'sort_order' => $index + 1,
                'classification' => $itemData['classification'] ?? null,
                'billing_frequency' => $itemData['billing_frequency'] ?? null,
                'billing_months' => $itemData['billing_months'] ?? null,
                'requires_preview_confirmation' => $itemData['requires_preview_confirmation'] ?? false,
            ]);

            $agreementItemsByCode->put($feeItem->code, $agreementItem);
        }

        foreach ($data['discounts'] ?? [] as $discountData) {
            $scope = $discountData['scope'] ?? $this->defaultDiscountScope($discountData['discount_type']);

            $discount = FeeAgreementDiscount::query()->create([
                'school_id' => $agreement->school_id,
                'fee_agreement_id' => $agreement->id,
                'discount_label' => $discountData['discount_label'],
                'discount_type' => $discountData['discount_type'],
                'scope' => $scope,
                'value' => $discountData['value'],
                'remark' => $discountData['remark'],
                'created_by' => $userId,
            ]);

            if ($scope === 'selected_fee_items') {
                $this->syncSelectedFeeItems($discount, $agreementItemsByCode, $discountData['selected_fee_codes'] ?? []);
            }
        }
    }

    /**
     * @param Collection<string, FeeAgreementItem> $agreementItemsByCode
     * @param array<int, string> $selectedFeeCodes
     */
    private function syncSelectedFeeItems(
        FeeAgreementDiscount $discount,
        Collection $agreementItemsByCode,
        array $selectedFeeCodes,
    ): void {
        $itemIds = collect($selectedFeeCodes)
            ->map(fn (string $code) => $agreementItemsByCode->get($code)?->id)
            ->filter()
            ->values()
            ->all();

        if (count($itemIds) !== count(array_unique($selectedFeeCodes))) {
            throw ValidationException::withMessages([
                'discounts' => 'Every selected fee code must belong to the Fee Agreement.',
            ]);
        }

        $discount->selectedItems()->sync($itemIds);
    }

    private function defaultDiscountScope(string $discountType): string
    {
        return $discountType === 'percentage' ? 'tuition_only' : 'total_payable';
    }
}
