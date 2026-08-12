<?php

namespace App\Policies;

use App\Models\Subject;
use App\Models\User;
use App\Policies\Concerns\ChecksSchoolScope;

class SubjectPolicy
{
    use ChecksSchoolScope;

    public function update(User $user, Subject $subject): bool
    {
        return $this->sameSchool($user, $subject);
    }
}
