<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $duplicateCurrentAgreementExists = DB::table('fee_agreements')
            ->select('school_id', 'student_id', 'academic_year')
            ->where('is_current', true)
            ->groupBy('school_id', 'student_id', 'academic_year')
            ->havingRaw('COUNT(*) > 1')
            ->exists();

        if ($duplicateCurrentAgreementExists) {
            throw new RuntimeException(
                'Cannot add the current Fee Agreement constraint while duplicate current agreements exist.',
            );
        }

        $duplicateScheduledChargeExists = DB::table('fee_record_charges')
            ->select('school_id', 'fee_agreement_item_id', 'billing_month')
            ->whereNotNull('fee_agreement_item_id')
            ->groupBy('school_id', 'fee_agreement_item_id', 'billing_month')
            ->havingRaw('COUNT(*) > 1')
            ->exists();

        if ($duplicateScheduledChargeExists) {
            throw new RuntimeException(
                'Cannot add the scheduled charge constraint while duplicate agreement-item charges exist.',
            );
        }

        Schema::table('fee_agreements', function (Blueprint $table): void {
            $table->unsignedTinyInteger('current_slot')->nullable()->after('is_current');
        });

        DB::table('fee_agreements')
            ->where('is_current', true)
            ->update(['current_slot' => 1]);

        Schema::table('fee_agreements', function (Blueprint $table): void {
            $table->unique(
                ['school_id', 'student_id', 'academic_year', 'current_slot'],
                'fee_agreements_one_current_unique',
            );
        });

        Schema::table('fee_record_charges', function (Blueprint $table): void {
            $table->dropIndex('fee_record_agreement_item_month_idx');
            $table->unique(
                ['school_id', 'fee_agreement_item_id', 'billing_month'],
                'fee_record_scheduled_item_month_unique',
            );
        });
    }

    public function down(): void
    {
        Schema::table('fee_record_charges', function (Blueprint $table): void {
            $table->dropUnique('fee_record_scheduled_item_month_unique');
            $table->index(
                ['school_id', 'fee_agreement_item_id', 'billing_month'],
                'fee_record_agreement_item_month_idx',
            );
        });

        Schema::table('fee_agreements', function (Blueprint $table): void {
            $table->dropUnique('fee_agreements_one_current_unique');
            $table->dropColumn('current_slot');
        });
    }
};
