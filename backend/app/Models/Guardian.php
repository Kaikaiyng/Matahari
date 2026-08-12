<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Guardian extends Model
{
    protected $table = 'parents';

    protected $fillable = [
        'school_id',
        'user_id',
        'full_name',
        'phone',
        'email',
        'address',
        'emergency_contact',
        'notes',
    ];

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function portalUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function students(): BelongsToMany
    {
        return $this->belongsToMany(Student::class, 'student_parent_links', 'parent_id', 'student_id')
            ->withPivot([
                'school_id', 'relationship', 'status', 'is_primary_contact', 'can_view_finance',
                'can_view_academics', 'starts_on', 'ended_on', 'current_slot',
            ])
            ->withTimestamps();
    }
}
