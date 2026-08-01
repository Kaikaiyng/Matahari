<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const COLUMNS = [
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
    ];

    public function up(): void
    {
        $existingColumns = array_fill_keys(
            array_map('strtolower', Schema::getColumnListing('audit_logs')),
            true,
        );

        foreach (self::COLUMNS as $column) {
            if (isset($existingColumns[$column])) {
                continue;
            }

            Schema::table('audit_logs', function (Blueprint $table) use ($column): void {
                match ($column) {
                    'event_uuid' => $table->uuid('event_uuid')->nullable(),
                    'request_id' => $table->uuid('request_id')->nullable(),
                    'batch_id' => $table->uuid('batch_id')->nullable(),
                    'actor_username' => $table->string('actor_username', 50)->nullable(),
                    'actor_roles' => $table->json('actor_roles')->nullable(),
                    'module' => $table->string('module', 100)->nullable(),
                    'metadata' => $table->json('metadata')->nullable(),
                    'reason' => $table->text('reason')->nullable(),
                    'related_audit_id' => $table->unsignedBigInteger('related_audit_id')->nullable(),
                    'route_name' => $table->string('route_name')->nullable(),
                    'http_method' => $table->string('http_method', 10)->nullable(),
                    'context_type' => $table->string('context_type', 20)->default('system'),
                    'schema_version' => $table->unsignedSmallInteger('schema_version')->default(1),
                };
            });

            $existingColumns[$column] = true;
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('audit_logs')) {
            return;
        }

        foreach (array_reverse(self::COLUMNS) as $column) {
            if (! Schema::hasColumn('audit_logs', $column)) {
                continue;
            }

            Schema::table('audit_logs', function (Blueprint $table) use ($column): void {
                $table->dropColumn($column);
            });
        }
    }
};
