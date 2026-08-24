<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\CommunityComment;
use App\Models\CommunityPost;
use App\Models\CommunityPostMedia;
use App\Models\School;
use App\Models\SchoolClass;
use App\Services\Community\CommunityAccessService;
use App\Services\Community\CommunityService;
use App\Services\Community\SchoolUpdateAudienceResolver;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CommunityController extends Controller
{
    public function index(Request $request, CommunityAccessService $access): JsonResponse
    {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;
        $tenantId = (int) School::query()->whereKey($schoolId)->value('tenant_id');
        $blockedUserIds = $access->blockedUserIds($request->user(), $tenantId, $schoolId);
        $posts = $access->visiblePosts($request->user(), $schoolId)
            ->with(['author:id,name', 'audiences', 'media', 'comments' => fn ($q) => $q->where('status', 'visible')->when($blockedUserIds !== [], fn ($comments) => $comments->whereNotIn('user_id', $blockedUserIds))->with('user:id,name')->oldest()])
            ->withCount(['reactions' => fn ($q) => $q->when($blockedUserIds !== [], fn ($reactions) => $reactions->whereNotIn('user_id', $blockedUserIds))])
            ->withExists(['reactions as reacted_by_me' => fn ($q) => $q->where('user_id', $request->user()->id)])
            ->latest('published_at')->limit(50)->get();

        return response()->json(['data' => $posts->map(fn (CommunityPost $post) => $this->response($post))]);
    }

    public function store(Request $request, CommunityService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
            'notify_audience' => ['sometimes', 'boolean'],
            'media' => ['sometimes', 'array', 'max:6'],
            'media.*' => ['file', 'max:10240', 'mimetypes:image/jpeg,image/png,image/webp'],
        ]);
        $schoolId = SchoolContext::fromRequest($request)->schoolId;
        $data['audiences'] = $this->validatedAudiences($request, $schoolId);
        $post = $service->publish($schoolId, $data, $request->user(), $contexts->fromRequest($request));
        $post->load(['author:id,name', 'audiences', 'media', 'comments.user'])->loadCount('reactions')->setAttribute('reacted_by_me', false);

        return response()->json(['data' => $this->response($post)], 201);
    }

    public function publishingContext(Request $request): JsonResponse
    {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;

        return response()->json(['data' => [
            'classes' => SchoolClass::query()->where('school_id', $schoolId)->where('status', 'active')->orderBy('name')
                ->get(['id', 'name'])->map(fn (SchoolClass $class): array => ['id' => $class->id, 'name' => $class->name])->all(),
            'max_images' => 6,
            'notify_default' => true,
        ]]);
    }

    public function audiencePreview(Request $request, SchoolUpdateAudienceResolver $resolver): JsonResponse
    {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;

        return response()->json(['data' => $resolver->preview($schoolId, $this->validatedAudiences($request, $schoolId), $request->user()->id)]);
    }

    public function update(Request $request, CommunityPost $communityPost, CommunityService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);
        $post = $service->updatePost(SchoolContext::fromRequest($request)->schoolId, $communityPost, $data, $request->user(), $contexts->fromRequest($request));
        $post->load(['author:id,name', 'audiences', 'media', 'comments' => fn ($query) => $query->where('status', 'visible')->with('user:id,name')])
            ->loadCount('reactions')
            ->setAttribute('reacted_by_me', $post->reactions()->where('user_id', $request->user()->id)->exists());

        return response()->json(['data' => $this->response($post)]);
    }

    public function media(Request $request, CommunityPostMedia $communityPostMedia, CommunityAccessService $access): StreamedResponse|BinaryFileResponse
    {
        $post = CommunityPost::query()->findOrFail($communityPostMedia->community_post_id);
        $access->findVisible($request->user(), SchoolContext::fromRequest($request)->schoolId, $post);
        abort_unless($communityPostMedia->status === 'ready', 403);

        $disk = Storage::disk($communityPostMedia->storage_disk);
        if ($request->query('download')) {
            return $disk->download($communityPostMedia->storage_path, $communityPostMedia->original_name ?? 'community-file');
        }

        $path = $disk->path($communityPostMedia->storage_path);

        return response()->file($path, [
            'Content-Type' => $communityPostMedia->mime_type ?? 'application/octet-stream',
            'Content-Disposition' => 'inline; filename="'.($communityPostMedia->original_name ?? 'file').'"',
        ]);
    }

    public function removeComment(Request $request, CommunityComment $communityComment, CommunityService $service, AuditContextFactory $contexts): JsonResponse
    {
        $service->removeComment(SchoolContext::fromRequest($request)->schoolId, $communityComment, $request->user(), $contexts->fromRequest($request));

        return response()->json(['success' => true]);
    }

    public function hide(Request $request, CommunityPost $communityPost, CommunityService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);
        $service->hidePost(SchoolContext::fromRequest($request)->schoolId, $communityPost, $data['reason'], $request->user(), $contexts->fromRequest($request));

        return response()->json(['success' => true]);
    }

    public function destroy(Request $request, CommunityPost $communityPost, CommunityService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);
        $service->withdrawPost(SchoolContext::fromRequest($request)->schoolId, $communityPost, $request->user(), $contexts->fromRequest($request), $data['reason'] ?? null);

        return response()->json(['success' => true]);
    }

    public function reaction(Request $request, CommunityPost $communityPost, CommunityService $service, AuditContextFactory $contexts): JsonResponse
    {
        $post = $service->toggleReaction(SchoolContext::fromRequest($request)->schoolId, $communityPost, $request->user(), $contexts->fromRequest($request));

        return response()->json(['data' => ['post_id' => $post->id, 'reacted' => $post->reactions()->where('user_id', $request->user()->id)->exists(), 'reaction_count' => $post->reactions()->count()]]);
    }

    public function comment(Request $request, CommunityPost $communityPost, CommunityService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate(['body' => ['required', 'string', 'max:2000']]);
        $comment = $service->comment(SchoolContext::fromRequest($request)->schoolId, $communityPost, $data['body'], $request->user(), $contexts->fromRequest($request))->load('user:id,name');

        return response()->json(['data' => [
            'id' => $comment->id, 'body' => $comment->body, 'status' => $comment->status,
            'author' => $comment->user->name, 'author_user_id' => $comment->user_id,
            'created_at' => $comment->created_at?->toIso8601String(),
            'can_report_content' => false, 'can_report_user' => false,
        ]], 201);
    }

    private function response(CommunityPost $post): array
    {
        $userId = auth()->id();
        $isModerator = (bool) auth()->user()?->hasPermissionTo('community.moderate');

        return ['id' => $post->id, 'body' => $post->body, 'status' => $post->status, 'comments_enabled' => $post->comments_enabled, 'published_at' => $post->published_at?->toIso8601String(),
            'author' => ['id' => $post->author->id, 'name' => $post->author->name],
            'can_report_content' => $post->author_user_id !== $userId,
            'can_report_user' => $post->author_user_id !== $userId,
            'can_edit' => $post->author_user_id === $userId || $isModerator,
            'can_withdraw' => $post->author_user_id === $userId || $isModerator,
            'audiences' => $post->audiences->map(fn ($a) => ['type' => $a->audience_type, 'class_id' => $a->class_id, 'student_id' => $a->student_id]),
            'media' => $post->media->map(fn ($m) => ['id' => $m->id, 'type' => $m->media_type, 'name' => $m->original_name, 'url' => "/api/v1/community/media/{$m->id}"]),
            'reaction_count' => (int) ($post->reactions_count ?? 0), 'reacted_by_me' => (bool) ($post->reacted_by_me ?? false),
            'comments' => $post->comments->map(fn ($c) => [
                'id' => $c->id, 'body' => $c->body, 'author' => $c->user->name, 'author_user_id' => $c->user_id,
                'created_at' => $c->created_at?->toIso8601String(),
                'can_remove' => $c->user_id === $userId || $post->author_user_id === $userId || $isModerator,
                'can_report_content' => $c->user_id !== $userId, 'can_report_user' => $c->user_id !== $userId,
            ]),
            'can_moderate' => $isModerator,
        ];
    }

    /** @return list<array{type:'school'|'class',class_id?:int}> */
    private function validatedAudiences(Request $request, int $schoolId): array
    {
        $data = $request->validate([
            'audiences' => ['required', 'array', 'min:1', 'max:20'],
            'audiences.*.type' => ['required', Rule::in(['school', 'class'])],
            'audiences.*.class_id' => ['nullable', 'integer', 'required_if:audiences.*.type,class'],
        ]);
        $audiences = $data['audiences'];
        $hasSchoolAudience = collect($audiences)->contains(fn (array $audience): bool => $audience['type'] === 'school');
        if ($hasSchoolAudience && count($audiences) !== 1) {
            throw ValidationException::withMessages(['audiences' => 'A whole-school audience cannot be combined with other audiences.']);
        }

        $classIds = collect($audiences)->where('type', 'class')->pluck('class_id')->map(fn ($id): int => (int) $id)->values();
        if ($classIds->count() !== $classIds->unique()->count()) {
            throw ValidationException::withMessages(['audiences' => 'Each class may be selected only once.']);
        }
        if ($classIds->isNotEmpty() && SchoolClass::query()->where('school_id', $schoolId)->where('status', 'active')
            ->whereIn('id', $classIds->all())->count() !== $classIds->count()) {
            throw ValidationException::withMessages(['audiences' => 'Every class audience must be active and within the current school.']);
        }

        return $audiences;
    }
}
