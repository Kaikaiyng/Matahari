<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_destinations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('school_id')->nullable();
            $table->string('channel', 50);
            $table->string('destination_type', 50);
            $table->text('destination_address');
            $table->string('purpose', 100);
            $table->json('configuration')->nullable();
            $table->string('status', 20)->default('active');
            $table->timestamps();

            $table->foreign(
                ['tenant_id', 'school_id'],
                'notification_destinations_tenant_school_fk',
            )->references(['tenant_id', 'id'])->on('schools')->restrictOnDelete();
            $table->index(
                ['tenant_id', 'school_id', 'channel', 'purpose', 'status'],
                'notification_destinations_scope_lookup',
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_destinations');
    }
};
