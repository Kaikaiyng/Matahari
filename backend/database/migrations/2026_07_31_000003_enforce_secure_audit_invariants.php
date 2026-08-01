<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const REQUIRED_COLUMNS = [
        'event_uuid',
        'module',
        'context_type',
        'schema_version',
    ];

    private const INDEXES = [
        'audit_logs_event_uuid_unique' => [
            'columns' => ['event_uuid'],
            'unique' => true,
        ],
        'audit_logs_created_at_index' => [
            'columns' => ['created_at'],
            'unique' => false,
        ],
        'audit_logs_request_id_index' => [
            'columns' => ['request_id'],
            'unique' => false,
        ],
        'audit_logs_batch_id_index' => [
            'columns' => ['batch_id'],
            'unique' => false,
        ],
        'audit_logs_module_index' => [
            'columns' => ['module'],
            'unique' => false,
        ],
        'audit_logs_action_index' => [
            'columns' => ['action'],
            'unique' => false,
        ],
        'audit_logs_related_audit_id_index' => [
            'columns' => ['related_audit_id'],
            'unique' => false,
        ],
    ];

    public function up(): void
    {
        $this->assertRequiredColumnsExist();
        $this->backfillResidualNullValues();
        $this->assertBackfillComplete();
        $this->enforceRequiredColumns();

        foreach (self::INDEXES as $name => $definition) {
            $existing = $this->indexNamed($name);

            if ($existing !== null) {
                $this->assertMariaDbIndexMatches($name);
                $this->assertIndexMatches($name, $existing, $definition);

                continue;
            }

            Schema::table('audit_logs', function (Blueprint $table) use ($name, $definition): void {
                if ($definition['unique']) {
                    $table->unique($definition['columns'], $name);

                    return;
                }

                $table->index($definition['columns'], $name);
            });

            $this->assertMariaDbIndexMatches($name);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('audit_logs')) {
            return;
        }

        foreach (array_reverse(self::INDEXES, true) as $name => $definition) {
            $existing = $this->indexNamed($name);

            if ($existing === null) {
                continue;
            }

            $this->assertMariaDbIndexMatches($name);
            $this->assertIndexMatches($name, $existing, $definition);

            Schema::table('audit_logs', function (Blueprint $table) use ($name, $definition): void {
                if ($definition['unique']) {
                    $table->dropUnique($name);

                    return;
                }

                $table->dropIndex($name);
            });
        }

        $columns = collect(Schema::getColumns('audit_logs'))->keyBy(
            static fn (array $column): string => strtolower($column['name']),
        );

        if ($columns->has('event_uuid') && ! $columns->get('event_uuid')['nullable']) {
            Schema::table('audit_logs', function (Blueprint $table): void {
                $table->uuid('event_uuid')->nullable()->change();
            });
        }

        if ($columns->has('module') && ! $columns->get('module')['nullable']) {
            Schema::table('audit_logs', function (Blueprint $table): void {
                $table->string('module', 100)->nullable()->change();
            });
        }
    }

    private function backfillResidualNullValues(): void
    {
        $backfill = require __DIR__.'/2026_07_31_000002_backfill_secure_audit_columns.php';
        $backfill->up();
    }

    private function assertRequiredColumnsExist(): void
    {
        foreach (self::REQUIRED_COLUMNS as $column) {
            if (! Schema::hasColumn('audit_logs', $column)) {
                throw new RuntimeException(
                    "Cannot enforce secure audit constraints because audit_logs.{$column} does not exist.",
                );
            }
        }
    }

    private function assertBackfillComplete(): void
    {
        foreach (self::REQUIRED_COLUMNS as $column) {
            if (DB::table('audit_logs')->whereNull($column)->exists()) {
                throw new RuntimeException(
                    "Cannot enforce secure audit constraints while audit_logs.{$column} contains null values.",
                );
            }
        }
    }

    private function enforceRequiredColumns(): void
    {
        $columns = collect(Schema::getColumns('audit_logs'))->keyBy(
            static fn (array $column): string => strtolower($column['name']),
        );

        if ($columns->get('event_uuid')['nullable']) {
            Schema::table('audit_logs', function (Blueprint $table): void {
                $table->uuid('event_uuid')->nullable(false)->change();
            });
        }

        if ($columns->get('module')['nullable']) {
            Schema::table('audit_logs', function (Blueprint $table): void {
                $table->string('module', 100)->nullable(false)->change();
            });
        }
    }

    /**
     * @return array{name: string, columns: list<string>, type: string|null, unique: bool, primary: bool}|null
     */
    private function indexNamed(string $name): ?array
    {
        foreach (Schema::getIndexes('audit_logs') as $index) {
            if ($index['name'] === strtolower($name)) {
                return $index;
            }
        }

        return null;
    }

    /**
     * @param  array{name: string, columns: list<string>, type: string|null, unique: bool, primary: bool}  $existing
     * @param  array{columns: list<string>, unique: bool}  $expected
     */
    private function assertIndexMatches(string $name, array $existing, array $expected): void
    {
        $type = $existing['type'] === null ? null : strtolower($existing['type']);
        $matches = array_map('strtolower', $existing['columns']) === $expected['columns']
            && $existing['unique'] === $expected['unique']
            && $existing['primary'] === false
            && ($type === null || $type === 'btree');

        if (! $matches) {
            throw new RuntimeException(
                "Cannot manage secure audit index {$name} because its existing definition does not match.",
            );
        }
    }

    private function assertMariaDbIndexMatches(string $name): void
    {
        if (! in_array(DB::getDriverName(), ['mariadb', 'mysql'], true)) {
            return;
        }

        $statistics = DB::select(
            <<<'SQL'
                SELECT INDEX_TYPE AS index_type, SUB_PART AS sub_part
                FROM information_schema.statistics
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'audit_logs'
                  AND INDEX_NAME = ?
                ORDER BY SEQ_IN_INDEX
                SQL,
            [$name],
        );

        $matches = $statistics !== [];

        foreach ($statistics as $statistic) {
            $matches = $matches
                && strtolower((string) $statistic->index_type) === 'btree'
                && $statistic->sub_part === null;
        }

        if (! $matches) {
            throw new RuntimeException(
                "Cannot manage secure audit index {$name} because MariaDB/MySQL reports a non-BTREE or prefix definition.",
            );
        }
    }
};
