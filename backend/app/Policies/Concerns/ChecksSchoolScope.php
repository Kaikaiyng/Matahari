<?php

namespace App\Policies\Concerns;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

trait ChecksSchoolScope
{
    private function sameSchool(User $user, Model $model): bool
    {
        return $user->school_id === null || (int) $user->school_id === (int) $model->getAttribute('school_id');
    }
}
