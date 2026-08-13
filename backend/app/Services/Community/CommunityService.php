<?php

namespace App\Services\Community;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\CommunityComment;
use App\Models\CommunityPost;
use App\Models\CommunityPostReaction;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class CommunityService
{
    public function __construct(private readonly CommunityAccessService $access, private readonly AuditLoggerContract $audit) {}

    public function publish(int $schoolId, array $data, User $actor, AuditContext $context): CommunityPost
    {
        $this->access->assertCanPublish($actor, $schoolId, $data['audiences']);

        $storedPaths = [];
        try {
            return DB::transaction(function () use ($schoolId, $data, $actor, $context, &$storedPaths): CommunityPost {
                $post = CommunityPost::query()->create([
                    'school_id' => $schoolId, 'author_user_id' => $actor->id, 'post_type' => 'post',
                    'body' => trim($data['body']), 'comments_enabled' => $data['comments_enabled'] ?? true,
                    'status' => 'published', 'published_at' => now(),
                ]);
                foreach ($data['audiences'] as $audience) {
                    if ($audience['type'] === 'class') {
                        $class = SchoolClass::query()->where('school_id', $schoolId)->findOrFail($audience['class_id']);
                        $key = "class:{$class->id}";
                    } elseif ($audience['type'] === 'student') {
                        $student = Student::query()->where('school_id', $schoolId)->findOrFail($audience['student_id']);
                        $key = "student:{$student->id}";
                    } else {
                        $key = 'school';
                    }
                    $post->audiences()->create(['school_id' => $schoolId, 'audience_type' => $audience['type'], 'class_id' => $audience['class_id'] ?? null, 'student_id' => $audience['student_id'] ?? null, 'audience_key' => $key]);
                }
                foreach ($data['media'] ?? [] as $index => $file) {
                    $path = $file->storeAs("community/{$schoolId}/{$post->id}", Str::uuid().'.'.$file->extension(), 'local');
                    $storedPaths[] = $path;
                    $post->media()->create([
                        'school_id' => $schoolId, 'media_type' => str_starts_with((string) $file->getMimeType(), 'image/') ? 'image' : (str_starts_with((string) $file->getMimeType(), 'video/') ? 'video' : 'file'),
                        'storage_disk' => 'local', 'storage_path' => $path, 'original_name' => $file->getClientOriginalName(),
                        'mime_type' => $file->getMimeType(), 'size_bytes' => $file->getSize(), 'sort_order' => $index, 'status' => 'ready',
                    ]);
                }
                $this->audit->record(new AuditEvent(action: AuditAction::CommunityPostPublished, module: AuditModule::Community, schoolId: $schoolId, subjectType: AuditSubject::CommunityPost, subjectId: $post->id, newValues: ['audiences' => $post->audiences()->pluck('audience_key')->all(), 'comments_enabled' => $post->comments_enabled]), $context);

                return $post;
            });
        } catch (Throwable $exception) {
            Storage::disk('local')->delete($storedPaths);
            throw $exception;
        }
    }

    public function toggleReaction(int $schoolId, CommunityPost $post, User $actor, AuditContext $context): CommunityPost
    {
        $this->access->findVisible($actor, $schoolId, $post);

        return DB::transaction(function () use ($schoolId, $post, $actor, $context): CommunityPost {
            $existing = CommunityPostReaction::query()->where('community_post_id', $post->id)->where('user_id', $actor->id)->lockForUpdate()->first();
            $active = ! $existing;
            $existing?->delete();
            if ($active) {
                CommunityPostReaction::query()->create(['school_id' => $schoolId, 'community_post_id' => $post->id, 'user_id' => $actor->id, 'reaction_type' => 'appreciate']);
            }
            $this->audit->record(new AuditEvent(action: AuditAction::CommunityReactionUpdated, module: AuditModule::Community, schoolId: $schoolId, subjectType: AuditSubject::CommunityPost, subjectId: $post->id, newValues: ['active' => $active]), $context);

            return $post;
        });
    }

    public function comment(int $schoolId, CommunityPost $post, string $body, User $actor, AuditContext $context): CommunityComment
    {
        $this->access->findVisible($actor, $schoolId, $post);
        abort_unless($post->comments_enabled, 409, 'Comments are disabled for this post.');

        return DB::transaction(function () use ($schoolId, $post, $body, $actor, $context): CommunityComment {
            $comment = CommunityComment::query()->create(['school_id' => $schoolId, 'community_post_id' => $post->id, 'user_id' => $actor->id, 'body' => trim($body), 'status' => 'visible']);
            $this->audit->record(new AuditEvent(action: AuditAction::CommunityCommentCreated, module: AuditModule::Community, schoolId: $schoolId, subjectType: AuditSubject::CommunityComment, subjectId: $comment->id, newValues: ['post_id' => $post->id]), $context);

            return $comment;
        });
    }

    public function removeComment(int $schoolId, CommunityComment $comment, User $actor, AuditContext $context): void
    {
        $post = CommunityPost::query()->findOrFail($comment->community_post_id);
        $this->access->findVisible($actor, $schoolId, $post);
        abort_unless($comment->user_id === $actor->id || $post->author_user_id === $actor->id || $actor->hasPermissionTo('community.moderate'), 403);
        DB::transaction(function () use ($schoolId, $comment, $actor, $context): void {
            $comment->update(['status' => 'removed', 'removed_at' => now()]);
            $this->audit->record(new AuditEvent(action: AuditAction::CommunityCommentRemoved, module: AuditModule::Community, schoolId: $schoolId, subjectType: AuditSubject::CommunityComment, subjectId: $comment->id, newValues: ['removed_by' => $actor->id]), $context);
        });
    }

    public function hidePost(int $schoolId, CommunityPost $post, string $reason, User $actor, AuditContext $context): void
    {
        abort_unless((int) $post->school_id === $schoolId && $actor->hasPermissionTo('community.moderate'), 403);
        DB::transaction(function () use ($schoolId, $post, $reason, $actor, $context): void {
            $post->update(['status' => 'hidden', 'hidden_at' => now(), 'hidden_by_user_id' => $actor->id, 'moderation_reason' => trim($reason)]);
            $this->audit->record(new AuditEvent(action: AuditAction::CommunityPostHidden, module: AuditModule::Community, schoolId: $schoolId, subjectType: AuditSubject::CommunityPost, subjectId: $post->id, newValues: ['reason' => trim($reason)]), $context);
        });
    }
}
