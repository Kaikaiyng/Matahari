<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fee_agreements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->string('agreement_no', 50)->nullable();
            $table->string('academic_year', 20);
            $table->unsignedInteger('version_no')->default(1);
            $table->string('payment_plan', 30);
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->boolean('is_current')->default(false);
            $table->string('status', 30)->default('draft');
            $table->text('remarks')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['school_id', 'student_id']);
            $table->index(['school_id', 'academic_year']);
            $table->index(['school_id', 'student_id', 'academic_year', 'is_current'], 'fee_agreements_current_lookup');
            $table->unique(['school_id', 'student_id', 'academic_year', 'version_no'], 'fee_agreements_version_unique');
        });

        Schema::create('fee_agreement_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('fee_agreement_id')->constrained()->cascadeOnDelete();
            $table->foreignId('fee_item_id')->nullable()->constrained()->nullOnDelete();
            $table->string('fee_code', 50);
            $table->string('fee_category', 30);
            $table->string('description');
            $table->decimal('amount', 10, 2)->default(0);
            $table->boolean('is_mandatory')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['fee_agreement_id']);
            $table->index(['school_id', 'fee_code']);
        });

        Schema::create('fee_agreement_discounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('fee_agreement_id')->constrained()->cascadeOnDelete();
            $table->string('discount_label');
            $table->string('discount_type', 30);
            $table->string('scope', 30);
            $table->decimal('value', 10, 2)->default(0);
            $table->text('remark');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['fee_agreement_id']);
        });

        Schema::create('fee_agreement_discount_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('fee_agreement_discount_id')->constrained()->cascadeOnDelete();
            $table->foreignId('fee_agreement_item_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['fee_agreement_discount_id', 'fee_agreement_item_id'], 'fee_discount_item_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fee_agreement_discount_items');
        Schema::dropIfExists('fee_agreement_discounts');
        Schema::dropIfExists('fee_agreement_items');
        Schema::dropIfExists('fee_agreements');
    }
};
