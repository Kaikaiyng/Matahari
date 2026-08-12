<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('portal_notifications', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->restrictOnDelete();
            $table->foreignId('recipient_user_id')->constrained('users')->restrictOnDelete();
            $table->string('type', 50)->default('general');
            $table->string('title', 255);
            $table->text('body');
            $table->json('context_json')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['recipient_user_id', 'read_at'], 'portal_notifications_user_read_idx');
            $table->index(['school_id', 'recipient_user_id'], 'portal_notifications_school_user_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('portal_notifications');
    }
};
