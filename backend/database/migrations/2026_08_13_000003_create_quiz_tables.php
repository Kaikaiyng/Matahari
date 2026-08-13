<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quizzes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->restrictOnDelete();
            $table->foreignId('subject_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('assessment_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('owner_user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('practice_owner_student_id')->nullable()->constrained('students')->restrictOnDelete();
            $table->string('quiz_kind', 24);
            $table->string('title', 200);
            $table->text('instructions')->nullable();
            $table->string('status', 24)->default('draft');
            $table->foreignId('revision_of_id')->nullable()->constrained('quizzes')->restrictOnDelete();
            $table->unsignedInteger('version_number')->default(1);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['school_id', 'quiz_kind', 'status'], 'quizzes_school_kind_status_index');
            $table->index(['school_id', 'owner_user_id', 'created_at'], 'quizzes_owner_index');
            $table->unique(['revision_of_id', 'version_number'], 'quiz_revision_version_unique');
        });

        Schema::create('quiz_questions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('quiz_id')->constrained()->cascadeOnDelete();
            $table->string('question_type', 30);
            $table->text('prompt');
            $table->text('explanation')->nullable();
            $table->decimal('points', 8, 2)->default(1);
            $table->unsignedSmallInteger('position');
            $table->timestamps();

            $table->unique(['quiz_id', 'position'], 'quiz_question_position_unique');
        });

        Schema::create('quiz_options', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('quiz_question_id')->constrained('quiz_questions')->cascadeOnDelete();
            $table->text('option_text');
            $table->boolean('is_correct')->default(false);
            $table->unsignedSmallInteger('position');
            $table->timestamps();

            $table->unique(['quiz_question_id', 'position'], 'quiz_option_position_unique');
        });

        Schema::create('quiz_assignments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->restrictOnDelete();
            $table->foreignId('quiz_id')->constrained()->restrictOnDelete();
            $table->foreignId('assigned_by_user_id')->constrained('users')->restrictOnDelete();
            $table->timestamp('available_from')->nullable();
            $table->timestamp('due_at')->nullable();
            $table->unsignedSmallInteger('attempt_limit')->default(1);
            $table->string('status', 24)->default('draft');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['school_id', 'status', 'available_from'], 'quiz_assignments_school_status_index');
            $table->index(['school_id', 'due_at'], 'quiz_assignments_due_index');
        });

        Schema::create('quiz_assignment_class_targets', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->restrictOnDelete();
            $table->foreignId('quiz_assignment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->restrictOnDelete();
            $table->timestamps();

            $table->unique(['quiz_assignment_id', 'class_id'], 'quiz_assignment_class_unique');
            $table->index(['school_id', 'class_id'], 'quiz_assignment_class_scope_index');
        });

        Schema::create('quiz_assignment_student_targets', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->restrictOnDelete();
            $table->foreignId('quiz_assignment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->timestamps();

            $table->unique(['quiz_assignment_id', 'student_id'], 'quiz_assignment_student_unique');
            $table->index(['school_id', 'student_id'], 'quiz_assignment_student_scope_index');
        });

        Schema::create('quiz_assignment_recipients', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->restrictOnDelete();
            $table->foreignId('quiz_assignment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->string('eligibility_source', 24);
            $table->timestamp('resolved_at');
            $table->timestamps();

            $table->unique(['quiz_assignment_id', 'student_id'], 'quiz_assignment_recipient_unique');
            $table->index(['school_id', 'student_id', 'resolved_at'], 'quiz_recipients_student_index');
        });

        Schema::create('quiz_attempts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->restrictOnDelete();
            $table->foreignId('quiz_id')->constrained()->restrictOnDelete();
            $table->foreignId('quiz_assignment_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->string('attempt_context_key', 120);
            $table->unsignedSmallInteger('attempt_number');
            $table->string('status', 24)->default('in_progress');
            $table->timestamp('started_at');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('scored_at')->nullable();
            $table->decimal('score', 8, 2)->nullable();
            $table->decimal('max_score', 8, 2)->nullable();
            $table->foreignId('scored_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['student_id', 'attempt_context_key', 'attempt_number'], 'quiz_attempt_context_unique');
            $table->index(['school_id', 'student_id', 'status'], 'quiz_attempts_student_status_index');
        });

        Schema::create('quiz_attempt_answers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('quiz_attempt_id')->constrained()->cascadeOnDelete();
            $table->foreignId('quiz_question_id')->constrained()->restrictOnDelete();
            $table->foreignId('quiz_option_id')->nullable()->constrained()->restrictOnDelete();
            $table->boolean('is_correct')->nullable();
            $table->decimal('awarded_points', 8, 2)->nullable();
            $table->timestamp('answered_at')->nullable();
            $table->timestamps();

            $table->unique(['quiz_attempt_id', 'quiz_question_id'], 'quiz_attempt_question_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quiz_attempt_answers');
        Schema::dropIfExists('quiz_attempts');
        Schema::dropIfExists('quiz_assignment_recipients');
        Schema::dropIfExists('quiz_assignment_student_targets');
        Schema::dropIfExists('quiz_assignment_class_targets');
        Schema::dropIfExists('quiz_assignments');
        Schema::dropIfExists('quiz_options');
        Schema::dropIfExists('quiz_questions');
        Schema::dropIfExists('quizzes');
    }
};
