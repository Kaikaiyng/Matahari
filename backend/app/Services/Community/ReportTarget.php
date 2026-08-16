<?php

namespace App\Services\Community;

use App\Models\CommunityComment;
use App\Models\CommunityPost;
use App\Models\User;

final readonly class ReportTarget
{
    public function __construct(
        public string $type,
        public ?CommunityPost $post,
        public ?CommunityComment $comment,
        public User $reportedUser,
    ) {}
}
