<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TenantBranding extends Model
{
    protected $fillable = ['tenant_id', 'organization_name', 'organization_short_name', 'admin_title', 'app_title', 'logo_url', 'primary_color', 'accent_color'];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
