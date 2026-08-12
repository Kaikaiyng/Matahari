<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('academic_years', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->restrictOnDelete();
            $table->string('code', 20);
            $table->string('name', 100);
            $table->date('starts_on')->nullable();
            $table->date('ends_on')->nullable();
            $table->string('status', 30)->default('draft');
            $table->unsignedTinyInteger('current_slot')->nullable();
            $table->timestamps();

            $table->unique(['school_id', 'code']);
            $table->unique(['school_id', 'current_slot']);
            $table->index(['school_id', 'status']);
        });

        Schema::create('subjects', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->restrictOnDelete();
            $table->string('code', 50);
            $table->string('name', 150);
            $table->string('status', 30)->default('active');
            $table->timestamps();

            $table->unique(['school_id', 'code']);
            $table->unique(['school_id', 'name']);
            $table->index(['school_id', 'status']);
        });

        Schema::create('class_enrolments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->restrictOnDelete();
            $table->foreignId('academic_year_id')->constrained()->restrictOnDelete();
            $table->foreignId('class_id')->constrained('classes')->restrictOnDelete();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->date('starts_on')->nullable();
            $table->date('ends_on')->nullable();
            $table->string('status', 30)->default('active');
            $table->unsignedTinyInteger('current_slot')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('ended_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();

            $table->unique(
                ['school_id', 'academic_year_id', 'student_id', 'current_slot'],
                'class_enrolments_current_unique',
            );
            $table->index(['school_id', 'academic_year_id', 'class_id', 'status'], 'class_enrolments_class_idx');
            $table->index(['school_id', 'student_id', 'academic_year_id'], 'class_enrolments_student_idx');
        });

        Schema::create('teaching_assignments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->restrictOnDelete();
            $table->foreignId('academic_year_id')->constrained()->restrictOnDelete();
            $table->foreignId('class_id')->constrained('classes')->restrictOnDelete();
            $table->foreignId('subject_id')->constrained()->restrictOnDelete();
            $table->foreignId('teacher_user_id')->constrained('users')->restrictOnDelete();
            $table->date('starts_on')->nullable();
            $table->date('ends_on')->nullable();
            $table->string('status', 30)->default('active');
            $table->unsignedTinyInteger('current_slot')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('ended_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();

            $table->unique(
                ['school_id', 'academic_year_id', 'class_id', 'subject_id', 'teacher_user_id', 'current_slot'],
                'teaching_assignments_current_unique',
            );
            $table->index(['school_id', 'teacher_user_id', 'academic_year_id', 'status'], 'teaching_assignments_teacher_idx');
            $table->index(['school_id', 'academic_year_id', 'class_id', 'subject_id'], 'teaching_assignments_scope_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teaching_assignments');
        Schema::dropIfExists('class_enrolments');
        Schema::dropIfExists('subjects');
        Schema::dropIfExists('academic_years');
    }
};
