<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('community_posts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->restrictOnDelete();
            $table->foreignId('author_user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('calendar_event_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('post_type', 30)->default('post');
            $table->text('body')->nullable();
            $table->boolean('comments_enabled')->default(true);
            $table->string('status', 24)->default('draft');
            $table->timestamp('published_at')->nullable();
            $table->timestamp('hidden_at')->nullable();
            $table->foreignId('hidden_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('moderation_reason', 500)->nullable();
            $table->timestamps();

            $table->index(['school_id', 'status', 'published_at'], 'community_posts_school_status_index');
            $table->index(['school_id', 'author_user_id', 'created_at'], 'community_posts_author_index');
        });

        Schema::create('community_post_audiences', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->restrictOnDelete();
            $table->foreignId('community_post_id')->constrained('community_posts')->cascadeOnDelete();
            $table->string('audience_type', 30);
            $table->foreignId('class_id')->nullable()->constrained('classes')->restrictOnDelete();
            $table->foreignId('student_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('audience_key', 100);
            $table->timestamps();

            $table->unique(['community_post_id', 'audience_key'], 'community_post_audience_unique');
            $table->index(['school_id', 'audience_type', 'class_id'], 'community_audience_class_index');
            $table->index(['school_id', 'audience_type', 'student_id'], 'community_audience_student_index');
        });

        Schema::create('community_post_media', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->restrictOnDelete();
            $table->foreignId('community_post_id')->constrained('community_posts')->cascadeOnDelete();
            $table->string('media_type', 24);
            $table->string('storage_disk', 50);
            $table->string('storage_path', 500);
            $table->string('original_name', 255)->nullable();
            $table->string('mime_type', 100)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->string('status', 24)->default('ready');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['community_post_id', 'sort_order'], 'community_post_media_order_unique');
            $table->index(['school_id', 'status'], 'community_post_media_school_status_index');
        });

        Schema::create('community_post_reactions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->restrictOnDelete();
            $table->foreignId('community_post_id')->constrained('community_posts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('reaction_type', 24)->default('appreciate');
            $table->timestamps();

            $table->unique(['community_post_id', 'user_id'], 'community_post_user_reaction_unique');
            $table->index(['school_id', 'user_id', 'created_at'], 'community_reactions_user_index');
        });

        Schema::create('community_comments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->restrictOnDelete();
            $table->foreignId('community_post_id')->constrained('community_posts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->text('body');
            $table->string('status', 24)->default('visible');
            $table->timestamp('hidden_at')->nullable();
            $table->foreignId('hidden_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('moderation_reason', 500)->nullable();
            $table->timestamp('removed_at')->nullable();
            $table->timestamps();

            $table->index(['school_id', 'community_post_id', 'status', 'created_at'], 'community_comments_post_index');
            $table->index(['school_id', 'user_id', 'created_at'], 'community_comments_user_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('community_comments');
        Schema::dropIfExists('community_post_reactions');
        Schema::dropIfExists('community_post_media');
        Schema::dropIfExists('community_post_audiences');
        Schema::dropIfExists('community_posts');
    }
};
