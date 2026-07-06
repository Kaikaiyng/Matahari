<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fee_items', function (Blueprint $table) {
            $table->string('category', 30)->default('optional')->after('fee_type');
            $table->unique(['school_id', 'code']);
            $table->index(['school_id', 'category']);
        });
    }

    public function down(): void
    {
        Schema::table('fee_items', function (Blueprint $table) {
            $table->dropUnique(['school_id', 'code']);
            $table->dropIndex(['school_id', 'category']);
            $table->dropColumn('category');
        });
    }
};
