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
        Schema::table('audit_logs', function (Blueprint $table): void {
            $table->uuid('event_uuid')->nullable();
            $table->uuid('request_id')->nullable();
            $table->uuid('batch_id')->nullable();
            $table->string('actor_username', 50)->nullable();
            $table->json('actor_roles')->nullable();
            $table->string('module', 100)->nullable();
            $table->json('metadata')->nullable();
            $table->text('reason')->nullable();
            $table->unsignedBigInteger('related_audit_id')->nullable();
            $table->string('route_name')->nullable();
            $table->string('http_method', 10)->nullable();
            $table->string('context_type', 20)->default('system');
            $table->unsignedSmallInteger('schema_version')->default(1);
        });

        DB::table('audit_logs')
            ->whereNull('event_uuid')
            ->orderBy('id')
            ->chunkById(500, function ($rows): void {
                foreach ($rows as $row) {
                    DB::table('audit_logs')
                        ->where('id', $row->id)
                        ->update([
                            'event_uuid' => (string) Str::uuid7(),
                            'module' => 'legacy',
                            'context_type' => 'system',
                            'schema_version' => 1,
                        ]);
                }
            });

        Schema::table('audit_logs', function (Blueprint $table): void {
            $table->uuid('event_uuid')->nullable(false)->change();
            $table->string('module', 100)->nullable(false)->change();
            $table->unique('event_uuid', 'audit_logs_event_uuid_unique');
            $table->index('created_at', 'audit_logs_created_at_index');
            $table->index('request_id', 'audit_logs_request_id_index');
            $table->index('batch_id', 'audit_logs_batch_id_index');
            $table->index('module', 'audit_logs_module_index');
            $table->index('action', 'audit_logs_action_index');
            $table->index('related_audit_id', 'audit_logs_related_audit_id_index');
        });
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table): void {
            $table->dropUnique('audit_logs_event_uuid_unique');
            $table->dropIndex('audit_logs_created_at_index');
            $table->dropIndex('audit_logs_request_id_index');
            $table->dropIndex('audit_logs_batch_id_index');
            $table->dropIndex('audit_logs_module_index');
            $table->dropIndex('audit_logs_action_index');
            $table->dropIndex('audit_logs_related_audit_id_index');
            $table->dropColumn([
                'event_uuid',
                'request_id',
                'batch_id',
                'actor_username',
                'actor_roles',
                'module',
                'metadata',
                'reason',
                'related_audit_id',
                'route_name',
                'http_method',
                'context_type',
                'schema_version',
            ]);
        });
    }
};
