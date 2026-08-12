<?php

namespace App\Policies;

use App\Models\AcademicYear;
use App\Models\User;
use App\Policies\Concerns\ChecksSchoolScope;

class AcademicYearPolicy
{
    use ChecksSchoolScope;

    public function update(User $user, AcademicYear $academicYear): bool
    {
        return $this->sameSchool($user, $academicYear);
    }
}
