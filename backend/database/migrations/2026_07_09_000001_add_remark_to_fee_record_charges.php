<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fee_record_charges', function (Blueprint $table): void {
            if (! Schema::hasColumn('fee_record_charges', 'remark')) {
                $table->text('remark')->nullable()->after('description');
            }
        });
    }

    public function down(): void
    {
        Schema::table('fee_record_charges', function (Blueprint $table): void {
            if (Schema::hasColumn('fee_record_charges', 'remark')) {
                $table->dropColumn('remark');
            }
        });
    }
};
