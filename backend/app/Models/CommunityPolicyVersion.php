<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CommunityPolicyVersion extends Model
{
    protected $fillable = ['policy_type', 'version', 'title', 'public_path', 'sections', 'effective_at', 'retired_at'];

    protected function casts(): array
    {
        return ['sections' => 'array', 'effective_at' => 'datetime', 'retired_at' => 'datetime'];
    }

    public function acceptances(): HasMany
    {
        return $this->hasMany(CommunityPolicyAcceptance::class);
    }
}
