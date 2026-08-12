<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('parents', function (Blueprint $table): void {
            $table->foreignId('user_id')->nullable()->after('school_id')->unique()->constrained()->restrictOnDelete();
        });

        Schema::table('students', function (Blueprint $table): void {
            $table->foreignId('user_id')->nullable()->after('school_id')->unique()->constrained()->restrictOnDelete();
        });

        Schema::table('student_parent_links', function (Blueprint $table): void {
            $table->string('status', 30)->default('unreviewed')->after('relationship');
            $table->boolean('can_view_finance')->nullable()->after('is_primary_contact');
            $table->boolean('can_view_academics')->nullable()->after('can_view_finance');
            $table->date('starts_on')->nullable()->after('can_view_academics');
            $table->date('ended_on')->nullable()->after('starts_on');
            $table->unsignedTinyInteger('current_slot')->nullable()->after('ended_on');
        });

        Schema::table('student_parent_links', function (Blueprint $table): void {
            $table->unique(['student_id', 'parent_id', 'current_slot'], 'student_parent_links_current_unique');
            $table->index(['school_id', 'status'], 'student_parent_links_status_idx');
        });

        Schema::table('student_parent_links', function (Blueprint $table): void {
            $table->dropUnique('student_parent_links_student_id_parent_id_relationship_unique');
        });
    }

    public function down(): void
    {
        $duplicates = DB::table('student_parent_links')
            ->select('student_id', 'parent_id', 'relationship')
            ->groupBy('student_id', 'parent_id', 'relationship')
            ->havingRaw('COUNT(*) > 1')
            ->exists();

        if ($duplicates) {
            throw new RuntimeException('Cannot roll back portal link history while duplicate historical relationships exist.');
        }

        Schema::table('student_parent_links', function (Blueprint $table): void {
            $table->unique(['student_id', 'parent_id', 'relationship']);
        });

        if (! in_array('student_parent_links_school_fk_idx', Schema::getIndexListing('student_parent_links'), true)) {
            Schema::table('student_parent_links', function (Blueprint $table): void {
                $table->index('school_id', 'student_parent_links_school_fk_idx');
            });
        }

        Schema::table('student_parent_links', function (Blueprint $table): void {
            $table->dropIndex('student_parent_links_status_idx');
            $table->dropUnique('student_parent_links_current_unique');
        });

        Schema::table('student_parent_links', function (Blueprint $table): void {
            $table->dropColumn([
                'status',
                'can_view_finance',
                'can_view_academics',
                'starts_on',
                'ended_on',
                'current_slot',
            ]);
        });

        Schema::table('students', function (Blueprint $table): void {
            $table->dropForeign(['user_id']);
        });
        Schema::table('students', function (Blueprint $table): void {
            $table->dropUnique(['user_id']);
            $table->dropColumn('user_id');
        });

        Schema::table('parents', function (Blueprint $table): void {
            $table->dropForeign(['user_id']);
        });
        Schema::table('parents', function (Blueprint $table): void {
            $table->dropUnique(['user_id']);
            $table->dropColumn('user_id');
        });
    }
};
