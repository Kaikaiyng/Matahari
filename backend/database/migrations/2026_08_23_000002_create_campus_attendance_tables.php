<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_settings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->unique()->constrained()->cascadeOnDelete();
            $table->time('arrival_time')->default('08:00:00');
            $table->time('dismissal_time')->default('15:00:00');
            $table->boolean('notify_guardians_on_entry')->default(true);
            $table->boolean('notify_guardians_on_exit')->default(true);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('attendance_devices', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('vendor', 50)->default('hikvision');
            $table->string('external_device_id', 100);
            $table->enum('direction_mode', ['entry', 'exit', 'bidirectional'])->default('bidirectional');
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->string('location')->nullable();
            $table->text('credential_secret')->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();

            $table->unique(['school_id', 'external_device_id'], 'attendance_devices_school_external_unique');
        });

        Schema::create('campus_attendance_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->restrictOnDelete();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->foreignId('attendance_device_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('direction', ['entry', 'exit']);
            $table->enum('method', ['face', 'card', 'manual', 'unknown'])->default('unknown');
            $table->date('event_date');
            $table->time('event_time');
            $table->timestamp('occurred_at');
            $table->string('source', 50)->default('admin');
            $table->string('external_event_id', 150)->nullable();
            $table->string('note', 500)->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['school_id', 'source', 'external_event_id'], 'campus_events_external_unique');
            $table->index(['school_id', 'event_date', 'direction'], 'campus_events_school_date_direction_idx');
            $table->index(['school_id', 'student_id', 'occurred_at'], 'campus_events_student_timeline_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('campus_attendance_events');
        Schema::dropIfExists('attendance_devices');
        Schema::dropIfExists('attendance_settings');
    }
};
