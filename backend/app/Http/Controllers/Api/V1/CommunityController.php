<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\CommunityComment;
use App\Models\CommunityPost;
use App\Models\CommunityPostMedia;
use App\Models\School;
use App\Services\Community\CommunityAccessService;
use App\Services\Community\CommunityService;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
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
            'body' => ['required', 'string', 'max:5000'], 'comments_enabled' => ['sometimes', 'boolean'],
            'audiences' => ['required', 'array', 'min:1', 'max:20'],
            'audiences.*.type' => ['required', Rule::in(['school', 'class', 'student'])],
            'audiences.*.class_id' => ['nullable', 'integer', 'required_if:audiences.*.type,class'],
            'audiences.*.student_id' => ['nullable', 'integer', 'required_if:audiences.*.type,student'],
            'media' => ['sometimes', 'array', 'max:6'],
            'media.*' => ['file', 'max:51200', 'mimetypes:image/jpeg,image/png,image/webp,video/mp4,video/quicktime,application/pdf'],
        ]);
        $post = $service->publish(SchoolContext::fromRequest($request)->schoolId, $data, $request->user(), $contexts->fromRequest($request));
        $post->load(['author:id,name', 'audiences', 'media', 'comments.user'])->loadCount('reactions')->setAttribute('reacted_by_me', false);

        return response()->json(['data' => $this->response($post)], 201);
    }

    public function media(Request $request, CommunityPostMedia $communityPostMedia, CommunityAccessService $access): StreamedResponse
    {
        $post = CommunityPost::query()->findOrFail($communityPostMedia->community_post_id);
        $access->findVisible($request->user(), SchoolContext::fromRequest($request)->schoolId, $post);
        abort_unless($communityPostMedia->status === 'ready', 404);

        return Storage::disk($communityPostMedia->storage_disk)
            ->download($communityPostMedia->storage_path, $communityPostMedia->original_name ?? 'community-file');
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

    public function reaction(Request $request, CommunityPost $communityPost, CommunityService $service, AuditContextFactory $contexts): JsonResponse
    {
        $post = $service->toggleReaction(SchoolContext::fromRequest($request)->schoolId, $communityPost, $request->user(), $contexts->fromRequest($request));

        return response()->json(['data' => ['post_id' => $post->id, 'reacted' => $post->reactions()->where('user_id', $request->user()->id)->exists(), 'reaction_count' => $post->reactions()->count()]]);
    }

    public function comment(Request $request, CommunityPost $communityPost, CommunityService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $request->validate(['body' => ['required', 'string', 'max:2000']]);
        $comment = $service->comment(SchoolContext::fromRequest($request)->schoolId, $communityPost, $data['body'], $request->user(), $contexts->fromRequest($request))->load('user:id,name');

        return response()->json(['data' => ['id' => $comment->id, 'body' => $comment->body, 'status' => $comment->status, 'author' => $comment->user->name, 'created_at' => $comment->created_at?->toIso8601String()]], 201);
    }

    private function response(CommunityPost $post): array
    {
        return ['id' => $post->id, 'body' => $post->body, 'status' => $post->status, 'comments_enabled' => $post->comments_enabled, 'published_at' => $post->published_at?->toIso8601String(),
            'author' => ['id' => $post->author->id, 'name' => $post->author->name],
            'audiences' => $post->audiences->map(fn ($a) => ['type' => $a->audience_type, 'class_id' => $a->class_id, 'student_id' => $a->student_id]),
            'media' => $post->media->map(fn ($m) => ['id' => $m->id, 'type' => $m->media_type, 'name' => $m->original_name, 'url' => "/api/v1/community/media/{$m->id}"]),
            'reaction_count' => (int) ($post->reactions_count ?? 0), 'reacted_by_me' => (bool) ($post->reacted_by_me ?? false),
            'comments' => $post->comments->map(fn ($c) => ['id' => $c->id, 'body' => $c->body, 'author' => $c->user->name, 'created_at' => $c->created_at?->toIso8601String(), 'can_remove' => $c->user_id === auth()->id() || $post->author_user_id === auth()->id() || auth()->user()?->hasPermissionTo('community.moderate')]),
            'can_moderate' => (bool) auth()->user()?->hasPermissionTo('community.moderate'),
        ];
    }
}
