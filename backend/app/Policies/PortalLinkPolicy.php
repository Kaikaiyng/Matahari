<?php

namespace App\Policies;

use App\Models\User;
use App\Policies\Concerns\ChecksSchoolScope;
use Illuminate\Database\Eloquent\Model;

class PortalLinkPolicy
{
    use ChecksSchoolScope;

    public function update(User $user, Model $record): bool
    {
        return $this->sameSchool($user, $record);
    }
}
