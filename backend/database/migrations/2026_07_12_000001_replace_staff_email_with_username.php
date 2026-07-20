<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('username', 50)->nullable()->after('name');
        });

        $usedUsernames = [];

        foreach (DB::table('users')->orderBy('id')->get(['id', 'email']) as $user) {
            $localPart = Str::lower(Str::before((string) $user->email, '@'));
            $base = preg_replace('/[^a-z0-9._-]+/', '-', $localPart) ?: 'user';
            $base = trim($base, '.-_');
            $base = Str::limit($base !== '' ? $base : 'user', 50, '');
            $username = $base;
            $suffix = 2;

            while (isset($usedUsernames[$username])) {
                $suffixText = (string) $suffix++;
                $username = Str::limit($base, 50 - strlen($suffixText), '').$suffixText;
            }

            $usedUsernames[$username] = true;
            DB::table('users')->where('id', $user->id)->update(['username' => $username]);
        }

        Schema::table('users', function (Blueprint $table): void {
            $table->dropUnique('users_email_unique');
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['email', 'email_verified_at']);
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->string('username', 50)->nullable(false)->change();
            $table->unique('username');
        });

        Schema::dropIfExists('password_reset_tokens');
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('email')->nullable()->after('name');
            $table->timestamp('email_verified_at')->nullable()->after('email');
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->unique('email');
            $table->dropUnique('users_username_unique');
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('username');
        });

        Schema::create('password_reset_tokens', function (Blueprint $table): void {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });
    }
};
