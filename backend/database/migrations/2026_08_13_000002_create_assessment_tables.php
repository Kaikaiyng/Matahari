<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('academic_terms', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->restrictOnDelete();
            $table->foreignId('academic_year_id')->constrained()->restrictOnDelete();
            $table->string('code', 30);
            $table->string('name', 100);
            $table->date('starts_on')->nullable();
            $table->date('ends_on')->nullable();
            $table->string('status', 24)->default('draft');
            $table->timestamps();

            $table->unique(['school_id', 'academic_year_id', 'code'], 'academic_terms_year_code_unique');
            $table->index(['school_id', 'academic_year_id', 'status'], 'academic_terms_year_status_index');
        });

        Schema::create('assessments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->restrictOnDelete();
            $table->foreignId('academic_year_id')->constrained()->restrictOnDelete();
            $table->foreignId('academic_term_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('subject_id')->constrained()->restrictOnDelete();
            $table->foreignId('created_by_user_id')->constrained('users')->restrictOnDelete();
            $table->string('title', 200);
            $table->string('assessment_type', 30);
            $table->decimal('max_score', 8, 2);
            $table->timestamp('due_at')->nullable();
            $table->string('status', 24)->default('draft');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['school_id', 'academic_year_id', 'status'], 'assessments_year_status_index');
            $table->index(['school_id', 'subject_id', 'due_at'], 'assessments_subject_due_index');
        });

        Schema::create('assessment_class_targets', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->restrictOnDelete();
            $table->foreignId('assessment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->restrictOnDelete();
            $table->timestamps();

            $table->unique(['assessment_id', 'class_id'], 'assessment_class_target_unique');
            $table->index(['school_id', 'class_id'], 'assessment_class_targets_scope_index');
        });

        Schema::create('assessment_results', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->restrictOnDelete();
            $table->foreignId('assessment_id')->constrained()->restrictOnDelete();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->decimal('score', 8, 2)->nullable();
            $table->string('grade_label', 50)->nullable();
            $table->text('teacher_comment')->nullable();
            $table->string('status', 24)->default('draft');
            $table->foreignId('assessed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->unique(['assessment_id', 'student_id'], 'assessment_student_result_unique');
            $table->index(['school_id', 'student_id', 'status'], 'assessment_results_student_status_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assessment_results');
        Schema::dropIfExists('assessment_class_targets');
        Schema::dropIfExists('assessments');
        Schema::dropIfExists('academic_terms');
    }
};
