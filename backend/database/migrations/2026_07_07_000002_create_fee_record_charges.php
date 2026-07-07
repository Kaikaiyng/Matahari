<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fee_agreement_items', function (Blueprint $table): void {
            if (! Schema::hasColumn('fee_agreement_items', 'classification')) {
                $table->string('classification', 30)->nullable()->after('sort_order');
            }

            if (! Schema::hasColumn('fee_agreement_items', 'billing_frequency')) {
                $table->string('billing_frequency', 30)->nullable()->after('classification');
            }

            if (! Schema::hasColumn('fee_agreement_items', 'billing_months')) {
                $table->json('billing_months')->nullable()->after('billing_frequency');
            }

            if (! Schema::hasColumn('fee_agreement_items', 'requires_preview_confirmation')) {
                $table->boolean('requires_preview_confirmation')->default(false)->after('billing_months');
            }
        });

        Schema::create('fee_record_charges', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->foreignId('fee_agreement_id')->constrained()->restrictOnDelete();
            $table->foreignId('fee_agreement_item_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('fee_item_id')->nullable()->constrained()->nullOnDelete();
            $table->string('academic_year', 20);
            $table->string('billing_month', 7);
            $table->string('fee_record_category', 30);
            $table->string('fee_code', 50)->nullable();
            $table->string('description');
            $table->decimal('expected_amount', 10, 2)->default(0);
            $table->decimal('paid_amount_cached', 10, 2)->default(0);
            $table->decimal('outstanding_amount_cached', 10, 2)->default(0);
            $table->string('billing_status', 30)->default('billable');
            $table->string('collection_status', 30)->default('unpaid');
            $table->string('charge_origin', 30)->default('scheduled');
            $table->string('source_type', 50)->nullable();
            $table->text('skipped_reason')->nullable();
            $table->timestamp('activated_at')->nullable();
            $table->timestamps();

            $table->index(['school_id', 'student_id', 'academic_year', 'billing_month'], 'fee_record_student_month_idx');
            $table->index(['school_id', 'fee_record_category', 'billing_month'], 'fee_record_category_month_idx');
            $table->index(['school_id', 'fee_agreement_item_id', 'billing_month'], 'fee_record_agreement_item_month_idx');
            $table->index(['school_id', 'collection_status'], 'fee_record_collection_status_idx');
            $table->index(['school_id', 'charge_origin'], 'fee_record_charge_origin_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fee_record_charges');

        Schema::table('fee_agreement_items', function (Blueprint $table): void {
            if (Schema::hasColumn('fee_agreement_items', 'requires_preview_confirmation')) {
                $table->dropColumn('requires_preview_confirmation');
            }

            if (Schema::hasColumn('fee_agreement_items', 'billing_months')) {
                $table->dropColumn('billing_months');
            }

            if (Schema::hasColumn('fee_agreement_items', 'billing_frequency')) {
                $table->dropColumn('billing_frequency');
            }

            if (Schema::hasColumn('fee_agreement_items', 'classification')) {
                $table->dropColumn('classification');
            }
        });
    }
};
