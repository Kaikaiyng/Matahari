<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            if (! Schema::hasColumn('payments', 'paid_by')) {
                $table->string('paid_by')->nullable()->after('amount');
            }
        });

        Schema::dropIfExists('receipts');
        Schema::dropIfExists('receipt_sequences');

        Schema::create('receipt_sequences', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('prefix', 30);
            $table->string('series', 10)->default('A');
            $table->unsignedInteger('current_number')->default(0);
            $table->timestamps();

            $table->unique(['school_id', 'prefix', 'series']);
        });

        Schema::create('receipts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payment_id')->constrained()->restrictOnDelete();
            $table->foreignId('active_payment_id')->nullable()->constrained('payments')->nullOnDelete();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->string('student_no', 50);
            $table->string('student_name');
            $table->string('paid_by');
            $table->string('payment_method', 30);
            $table->date('payment_date');
            $table->date('received_date')->nullable();
            $table->date('receipt_date');
            $table->string('receipt_no', 50);
            $table->decimal('amount', 10, 2)->default(0);
            $table->string('amount_in_words');
            $table->foreignId('issued_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('issued_at')->nullable();
            $table->string('status', 30)->default('issued');
            $table->timestamp('voided_at')->nullable();
            $table->foreignId('voided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('void_reason')->nullable();
            $table->timestamps();

            $table->unique(['school_id', 'receipt_no']);
            $table->unique(['school_id', 'active_payment_id']);
            $table->index(['school_id', 'payment_id']);
            $table->index(['school_id', 'student_id']);
            $table->index(['school_id', 'receipt_date']);
            $table->index(['school_id', 'status']);
        });

        Schema::create('receipt_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('receipt_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payment_allocation_id')->nullable()->constrained()->nullOnDelete();
            $table->string('fee_code', 50)->nullable();
            $table->string('description');
            $table->decimal('amount', 10, 2)->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['school_id', 'receipt_id']);
            $table->index(['school_id', 'payment_allocation_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('receipt_items');
        Schema::dropIfExists('receipts');
        Schema::dropIfExists('receipt_sequences');

        Schema::create('receipt_sequences', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('year');
            $table->string('prefix', 30);
            $table->unsignedInteger('current_number')->default(0);
            $table->timestamps();

            $table->unique(['school_id', 'year', 'prefix']);
        });

        Schema::create('receipts', function (Blueprint $table): void {
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

        Schema::table('payments', function (Blueprint $table): void {
            if (Schema::hasColumn('payments', 'paid_by')) {
                $table->dropColumn('paid_by');
            }
        });
    }
};
