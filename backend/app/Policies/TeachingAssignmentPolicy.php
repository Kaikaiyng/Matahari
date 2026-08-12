<?php

namespace App\Policies;

use App\Models\TeachingAssignment;
use App\Models\User;
use App\Policies\Concerns\ChecksSchoolScope;

class TeachingAssignmentPolicy
{
    use ChecksSchoolScope;

    public function update(User $user, TeachingAssignment $teachingAssignment): bool
    {
        return $this->sameSchool($user, $teachingAssignment);
    }
}
