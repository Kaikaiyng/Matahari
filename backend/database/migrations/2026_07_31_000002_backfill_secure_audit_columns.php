<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    private const REQUIRED_COLUMNS = [
        'event_uuid',
        'module',
        'context_type',
        'schema_version',
    ];

    public function up(): void
    {
        $this->assertRequiredColumnsExist();

        $this->backfillNullValues('event_uuid', static fn (): string => (string) Str::uuid7());
        $this->backfillNullValues('module', static fn (): string => 'legacy');
        $this->backfillNullValues('context_type', static fn (): string => 'system');
        $this->backfillNullValues('schema_version', static fn (): int => 1);
    }

    public function down(): void
    {
        // The backfill only populates Phase 1 columns removed by the addition stage.
    }

    private function assertRequiredColumnsExist(): void
    {
        foreach (self::REQUIRED_COLUMNS as $column) {
            if (! Schema::hasColumn('audit_logs', $column)) {
                throw new RuntimeException(
                    "Cannot backfill secure audit values because audit_logs.{$column} does not exist.",
                );
            }
        }
    }

    private function backfillNullValues(string $column, callable $value): void
    {
        DB::table('audit_logs')
            ->select('id')
            ->whereNull($column)
            ->orderBy('id')
            ->chunkById(500, function ($rows) use ($column, $value): void {
                foreach ($rows as $row) {
                    DB::table('audit_logs')
                        ->where('id', $row->id)
                        ->whereNull($column)
                        ->update([$column => $value()]);
                }
            });
    }
};
