<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AttendanceSetting extends Model
{
    protected $fillable = ['school_id', 'arrival_time', 'dismissal_time', 'notify_guardians_on_entry', 'notify_guardians_on_exit', 'updated_by'];

    protected function casts(): array
    {
        return ['notify_guardians_on_entry' => 'boolean', 'notify_guardians_on_exit' => 'boolean'];
    }
}
