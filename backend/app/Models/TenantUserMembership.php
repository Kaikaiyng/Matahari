<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class TenantUserMembership extends Model
{
    protected $fillable = ['tenant_id', 'user_id', 'default_school_id', 'access_all_schools', 'status'];

    protected function casts(): array
    {
        return ['access_all_schools' => 'boolean'];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function defaultSchool(): BelongsTo
    {
        return $this->belongsTo(School::class, 'default_school_id');
    }

    public function schools(): BelongsToMany
    {
        return $this->belongsToMany(School::class, 'tenant_membership_schools')->withTimestamps();
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'tenant_membership_roles')->withTimestamps();
    }
}
