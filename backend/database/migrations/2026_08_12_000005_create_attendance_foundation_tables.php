<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_sessions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('academic_year_id')->constrained()->restrictOnDelete();
            $table->foreignId('class_id')->constrained('classes')->restrictOnDelete();
            $table->foreignId('subject_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('teaching_assignment_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('session_type', 24);
            $table->date('attendance_date');
            $table->time('starts_at')->nullable();
            $table->string('session_key', 100);
            $table->string('status', 24)->default('submitted');
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();

            $table->unique(['school_id', 'session_key'], 'attendance_sessions_school_key_unique');
            $table->index(['school_id', 'attendance_date', 'class_id'], 'attendance_sessions_school_date_class_index');
        });

        Schema::create('attendance_records', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('attendance_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->string('status', 24);
            $table->string('public_note', 500)->nullable();
            $table->foreignId('marked_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('corrected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('correction_reason', 500)->nullable();
            $table->timestamp('corrected_at')->nullable();
            $table->timestamps();

            $table->unique(['attendance_session_id', 'student_id'], 'attendance_records_session_student_unique');
            $table->index(['school_id', 'student_id', 'created_at'], 'attendance_records_school_student_time_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_records');
        Schema::dropIfExists('attendance_sessions');
    }
};
