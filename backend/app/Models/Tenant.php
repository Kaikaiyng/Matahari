<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Tenant extends Model
{
    protected $fillable = ['slug', 'name', 'status', 'timezone', 'locale'];

    public function branding(): HasOne
    {
        return $this->hasOne(TenantBranding::class);
    }

    public function domains(): HasMany
    {
        return $this->hasMany(TenantDomain::class);
    }

    public function features(): HasMany
    {
        return $this->hasMany(TenantFeature::class);
    }

    public function schools(): HasMany
    {
        return $this->hasMany(School::class);
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(TenantUserMembership::class);
    }

    public function notificationDestinations(): HasMany
    {
        return $this->hasMany(NotificationDestination::class);
    }
}
