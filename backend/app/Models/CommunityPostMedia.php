<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CommunityPostMedia extends Model
{
    protected $table = 'community_post_media';

    protected $fillable = ['school_id', 'community_post_id', 'media_type', 'storage_disk', 'storage_path', 'original_name', 'mime_type', 'size_bytes', 'sort_order', 'status', 'metadata'];

    protected function casts(): array
    {
        return ['metadata' => 'array'];
    }
}
