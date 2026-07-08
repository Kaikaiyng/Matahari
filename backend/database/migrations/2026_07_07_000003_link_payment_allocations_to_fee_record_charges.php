<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_allocations', function (Blueprint $table): void {
            if (! Schema::hasColumn('payment_allocations', 'fee_record_charge_id')) {
                $table->foreignId('fee_record_charge_id')
                    ->nullable()
                    ->after('fee_agreement_item_id')
                    ->constrained('fee_record_charges')
                    ->nullOnDelete();
            }

            if (! Schema::hasColumn('payment_allocations', 'allocation_type')) {
                $table->string('allocation_type', 30)->default('legacy')->after('fee_record_charge_id');
            }

            $table->index(['school_id', 'fee_record_charge_id'], 'payment_allocations_charge_idx');
            $table->index(['school_id', 'allocation_type'], 'payment_allocations_type_idx');
        });
    }

    public function down(): void
    {
        Schema::table('payment_allocations', function (Blueprint $table): void {
            $table->dropIndex('payment_allocations_type_idx');
            $table->dropIndex('payment_allocations_charge_idx');

            if (Schema::hasColumn('payment_allocations', 'allocation_type')) {
                $table->dropColumn('allocation_type');
            }

            if (Schema::hasColumn('payment_allocations', 'fee_record_charge_id')) {
                $table->dropConstrainedForeignId('fee_record_charge_id');
            }
        });
    }
};
