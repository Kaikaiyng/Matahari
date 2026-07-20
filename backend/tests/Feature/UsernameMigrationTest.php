<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class UsernameMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_schema_and_seed_use_username_without_email(): void
    {
        $this->seed();

        $this->assertTrue(Schema::hasColumn('users', 'username'));
        $this->assertFalse(Schema::hasColumn('users', 'email'));
        $this->assertFalse(Schema::hasColumn('users', 'email_verified_at'));
        $this->assertFalse(Schema::hasTable('password_reset_tokens'));
        $this->assertSame(
            ['admin', 'finance', 'superadmin'],
            User::query()->orderBy('username')->pluck('username')->all(),
        );
        $this->assertTrue(User::query()->withCount('roles')->get()->every(
            fn (User $user) => $user->roles_count === 1,
        ));
    }
}
