<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $fillable = [
        'school_id',
        'is_platform_owner',
        'name',
        'username',
        'password',
        'status',
        'last_login_at',
    ];

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'user_roles')->withTimestamps();
    }

    public function tenantMemberships(): HasMany
    {
        return $this->hasMany(TenantUserMembership::class);
    }

    public function tenantMembership(int $tenantId): ?TenantUserMembership
    {
        return $this->tenantMemberships()->where('tenant_id', $tenantId)->first();
    }

    public function hasActiveTenantMembership(int $tenantId): bool
    {
        return $this->tenantMemberships()->where('tenant_id', $tenantId)->where('status', 'active')->exists();
    }

    public function applyTenantMembershipScope(int $tenantId): bool
    {
        if ($this->is_platform_owner) {
            $schoolIsInTenant = $this->school_id !== null && $this->school()->where('tenant_id', $tenantId)->exists();
            if (! $schoolIsInTenant) {
                $this->setAttribute('school_id', null);
                $this->unsetRelation('school');
            }

            return true;
        }

        $membership = $this->tenantMembership($tenantId);
        if (! $membership || $membership->status !== 'active' || ! $membership->default_school_id) {
            return false;
        }
        $schoolAllowed = $membership->defaultSchool()->where('tenant_id', $tenantId)->exists()
            && ($membership->access_all_schools || $membership->schools()->whereKey($membership->default_school_id)->exists());
        if (! $schoolAllowed) {
            return false;
        }

        $this->setAttribute('school_id', (int) $membership->default_school_id);
        $this->unsetRelation('school');

        return true;
    }

    public function teachingAssignments(): HasMany
    {
        return $this->hasMany(TeachingAssignment::class, 'teacher_user_id');
    }

    public function guardianProfile(): HasOne
    {
        return $this->hasOne(Guardian::class);
    }

    public function studentProfile(): HasOne
    {
        return $this->hasOne(Student::class);
    }

    public function createdCalendarEvents(): HasMany
    {
        return $this->hasMany(CalendarEvent::class, 'created_by');
    }

    public function updatedCalendarEvents(): HasMany
    {
        return $this->hasMany(CalendarEvent::class, 'updated_by');
    }

    public function hasPermissionTo(string $permissionSlug): bool
    {
        if (app()->bound(TenantContext::class)) {
            $tenantId = app(TenantContext::class)->tenantId();
            if (! $this->is_platform_owner) {
                return $this->tenantMemberships()
                    ->where('tenant_id', $tenantId)
                    ->where('status', 'active')
                    ->whereHas('roles.permissions', fn ($query) => $query->where('slug', $permissionSlug))
                    ->exists();
            }
        }

        return $this->roles()
            ->whereHas('permissions', fn ($query) => $query->where('slug', $permissionSlug))
            ->exists();
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'last_login_at' => 'datetime',
            'is_platform_owner' => 'boolean',
            'password' => 'hashed',
        ];
    }
}
