<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('slug', 100)->unique();
            $table->timestamps();
        });

        Schema::create('user_roles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('role_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'role_id']);
        });

        Schema::create('classes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('status', 30)->default('active');
            $table->timestamps();

            $table->unique(['school_id', 'name']);
        });

        Schema::create('students', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('class_id')->nullable()->constrained('classes')->nullOnDelete();
            $table->string('student_no', 50);
            $table->string('full_name');
            $table->string('gender', 20)->nullable();
            $table->date('dob')->nullable();
            $table->date('registration_date')->nullable();
            $table->string('status', 30)->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['school_id', 'student_no']);
            $table->index(['school_id', 'status']);
            $table->index(['school_id', 'class_id']);
        });

        Schema::create('parents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('full_name');
            $table->string('phone', 50);
            $table->string('email')->nullable();
            $table->text('address')->nullable();
            $table->string('emergency_contact', 50)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['school_id', 'phone']);
            $table->index(['school_id', 'email']);
        });

        Schema::create('student_parent_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_id')->constrained()->cascadeOnDelete();
            $table->string('relationship', 30)->default('guardian');
            $table->boolean('is_primary_contact')->default(false);
            $table->timestamps();

            $table->unique(['student_id', 'parent_id', 'relationship']);
        });

        Schema::create('fee_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code', 50)->nullable();
            $table->string('fee_type', 30);
            $table->decimal('default_amount', 10, 2)->default(0);
            $table->string('status', 30)->default('active');
            $table->timestamps();

            $table->unique(['school_id', 'name']);
        });

        Schema::create('student_fee_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('fee_item_id')->constrained()->restrictOnDelete();
            $table->decimal('amount', 10, 2)->default(0);
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->string('billing_month', 7)->nullable();
            $table->string('status', 30)->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['school_id', 'student_id', 'status']);
            $table->index(['school_id', 'fee_item_id']);
        });

        Schema::create('discount_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('discount_type', 30);
            $table->decimal('default_value', 10, 2)->default(0);
            $table->string('status', 30)->default('active');
            $table->timestamps();

            $table->unique(['school_id', 'name']);
        });

        Schema::create('student_discount_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('discount_item_id')->constrained()->restrictOnDelete();
            $table->string('discount_type', 30);
            $table->decimal('value', 10, 2)->default(0);
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->string('status', 30)->default('active');
            $table->string('reason')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['school_id', 'student_id', 'status']);
        });

        Schema::create('invoice_sequences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('year');
            $table->string('prefix', 30);
            $table->unsignedInteger('current_number')->default(0);
            $table->timestamps();

            $table->unique(['school_id', 'year', 'prefix']);
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->string('invoice_no', 50);
            $table->string('invoice_month', 7);
            $table->date('issue_date');
            $table->date('due_date');
            $table->decimal('subtotal', 10, 2)->default(0);
            $table->decimal('discount_total', 10, 2)->default(0);
            $table->decimal('grand_total', 10, 2)->default(0);
            $table->decimal('paid_amount', 10, 2)->default(0);
            $table->decimal('outstanding_amount', 10, 2)->default(0);
            $table->string('status', 30)->default('pending');
            $table->timestamp('voided_at')->nullable();
            $table->foreignId('voided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('void_reason')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['school_id', 'invoice_no']);
            $table->unique(['school_id', 'student_id', 'invoice_month']);
            $table->index(['school_id', 'invoice_month']);
            $table->index(['school_id', 'status']);
        });

        Schema::create('invoice_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->string('item_type', 30);
            $table->string('source_type', 100)->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('description');
            $table->decimal('quantity', 10, 2)->default(1);
            $table->decimal('unit_amount', 10, 2)->default(0);
            $table->decimal('line_total', 10, 2)->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['school_id', 'invoice_id']);
            $table->index(['source_type', 'source_id']);
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->string('payment_method', 30);
            $table->date('payment_date');
            $table->date('received_date')->nullable();
            $table->decimal('amount', 10, 2)->default(0);
            $table->string('bank_account')->nullable();
            $table->string('reference_no', 100)->nullable();
            $table->text('payment_proof')->nullable();
            $table->text('remark')->nullable();
            $table->string('status', 30)->default('pending_verification');
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->foreignId('voided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('void_reason')->nullable();
            $table->timestamps();

            $table->index(['school_id', 'payment_date']);
            $table->index(['school_id', 'student_id']);
            $table->index(['school_id', 'status']);
            $table->index(['school_id', 'reference_no']);
        });

        Schema::create('payment_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('fee_item_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('fee_agreement_item_id')->nullable();
            $table->string('fee_code', 50)->nullable();
            $table->string('description');
            $table->decimal('amount', 10, 2)->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['school_id', 'payment_id']);
            $table->index(['school_id', 'fee_item_id']);
            $table->index(['school_id', 'fee_agreement_item_id']);
        });

        Schema::create('receipt_sequences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('year');
            $table->string('prefix', 30);
            $table->unsignedInteger('current_number')->default(0);
            $table->timestamps();

            $table->unique(['school_id', 'year', 'prefix']);
        });

        Schema::create('receipts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payment_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->string('receipt_no', 50);
            $table->date('receipt_date');
            $table->decimal('amount', 10, 2)->default(0);
            $table->string('status', 30)->default('active');
            $table->foreignId('generated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('voided_at')->nullable();
            $table->foreignId('voided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('void_reason')->nullable();
            $table->timestamps();

            $table->unique(['school_id', 'receipt_no']);
            $table->index(['school_id', 'receipt_date']);
            $table->index(['school_id', 'status']);
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 100);
            $table->string('entity_type', 100)->nullable();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamps();

            $table->index(['school_id', 'created_at']);
            $table->index(['entity_type', 'entity_id']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('receipts');
        Schema::dropIfExists('receipt_sequences');
        Schema::dropIfExists('payment_allocations');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('invoice_items');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('invoice_sequences');
        Schema::dropIfExists('student_discount_assignments');
        Schema::dropIfExists('discount_items');
        Schema::dropIfExists('student_fee_assignments');
        Schema::dropIfExists('fee_items');
        Schema::dropIfExists('student_parent_links');
        Schema::dropIfExists('parents');
        Schema::dropIfExists('students');
        Schema::dropIfExists('classes');
        Schema::dropIfExists('user_roles');
        Schema::dropIfExists('roles');
    }
};
