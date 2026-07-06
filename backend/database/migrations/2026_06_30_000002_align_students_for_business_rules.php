<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->string('level_group', 30)->default('primary')->after('class_id');
            $table->index(['school_id', 'level_group']);
        });

        DB::table('students')
            ->whereNotIn('status', ['active', 'withdraw', 'graduate', 'inactive'])
            ->update(['status' => 'inactive']);
    }

    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->dropIndex(['school_id', 'level_group']);
            $table->dropColumn('level_group');
        });
    }
};
