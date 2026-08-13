<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CommunityPostReaction extends Model
{
    protected $fillable = ['school_id', 'community_post_id', 'user_id', 'reaction_type'];
}
