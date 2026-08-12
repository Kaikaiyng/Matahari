<?php

namespace App\Policies;

use App\Models\ClassEnrolment;
use App\Models\User;
use App\Policies\Concerns\ChecksSchoolScope;

class ClassEnrolmentPolicy
{
    use ChecksSchoolScope;

    public function update(User $user, ClassEnrolment $classEnrolment): bool
    {
        return $this->sameSchool($user, $classEnrolment);
    }
}
