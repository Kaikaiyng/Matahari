<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use InvalidArgumentException;

class NotificationDestination extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    protected $fillable = [
        'tenant_id',
        'school_id',
        'channel',
        'destination_type',
        'destination_address',
        'purpose',
        'configuration',
        'status',
    ];

    protected static function booted(): void
    {
        static::saving(function (self $destination): void {
            if ($destination->school_id === null) {
                return;
            }
            if ($destination->tenant_id === null) {
                throw new InvalidArgumentException('A school-scoped notification destination requires a tenant.');
            }
            if (! School::query()
                ->whereKey($destination->school_id)
                ->where('tenant_id', $destination->tenant_id)
                ->exists()) {
                throw new InvalidArgumentException('The notification destination school does not belong to the selected tenant.');
            }
        });
    }

    protected function casts(): array
    {
        return [
            'tenant_id' => 'integer',
            'school_id' => 'integer',
            'configuration' => 'array',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    public function scopeForScope(Builder $query, ?int $tenantId, ?int $schoolId): Builder
    {
        return $query
            ->when($tenantId === null, fn (Builder $scope): Builder => $scope->whereNull('tenant_id'), fn (Builder $scope): Builder => $scope->where('tenant_id', $tenantId))
            ->when($schoolId === null, fn (Builder $scope): Builder => $scope->whereNull('school_id'), fn (Builder $scope): Builder => $scope->where('school_id', $schoolId));
    }
}
