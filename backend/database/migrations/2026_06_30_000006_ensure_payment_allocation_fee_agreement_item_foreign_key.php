<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const CHILD_COLUMN = 'fee_agreement_item_id';

    private const CONSTRAINT_NAME = 'payment_allocations_fee_agreement_item_id_foreign';

    public function up(): void
    {
        $foreignKeys = $this->foreignKeysForChildColumn();

        if (count($foreignKeys) === 1 && $this->matchesExpectedDefinition($foreignKeys[0])) {
            return;
        }

        if ($foreignKeys !== []) {
            throw new RuntimeException(
                'Cannot ensure payment_allocations.fee_agreement_item_id foreign key because its existing definition does not match.',
            );
        }

        Schema::table('payment_allocations', function (Blueprint $table): void {
            $table->foreign(self::CHILD_COLUMN, self::CONSTRAINT_NAME)
                ->references('id')
                ->on('fee_agreement_items')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('payment_allocations', self::CHILD_COLUMN)) {
            return;
        }

        $foreignKeys = $this->foreignKeysForChildColumn();

        if ($foreignKeys === []) {
            return;
        }

        if (count($foreignKeys) !== 1 || ! $this->matchesExpectedDefinition($foreignKeys[0])) {
            throw new RuntimeException(
                'Cannot remove payment_allocations.fee_agreement_item_id foreign key because its existing definition does not match.',
            );
        }

        $foreignKey = $foreignKeys[0];
        $identifier = $foreignKey['name'] ?? [self::CHILD_COLUMN];

        Schema::table('payment_allocations', function (Blueprint $table) use ($identifier): void {
            $table->dropForeign($identifier);
        });
    }

    /**
     * @return list<array{
     *     name: string|null,
     *     columns: list<string>,
     *     foreign_schema: string|null,
     *     foreign_table: string,
     *     foreign_columns: list<string>,
     *     on_update: string,
     *     on_delete: string
     * }>
     */
    private function foreignKeysForChildColumn(): array
    {
        return array_values(array_filter(
            Schema::getForeignKeys('payment_allocations'),
            static fn (array $foreignKey): bool => in_array(
                self::CHILD_COLUMN,
                array_map('strtolower', $foreignKey['columns']),
                true,
            ),
        ));
    }

    /**
     * @param  array{
     *     name: string|null,
     *     columns: list<string>,
     *     foreign_schema: string|null,
     *     foreign_table: string,
     *     foreign_columns: list<string>,
     *     on_update: string,
     *     on_delete: string
     * }  $foreignKey
     */
    private function matchesExpectedDefinition(array $foreignKey): bool
    {
        return array_map('strtolower', $foreignKey['columns']) === [self::CHILD_COLUMN]
            && strtolower($foreignKey['foreign_table']) === 'fee_agreement_items'
            && array_map('strtolower', $foreignKey['foreign_columns']) === ['id']
            && strtolower($foreignKey['on_update']) === $this->expectedOnUpdate()
            && strtolower($foreignKey['on_delete']) === 'set null';
    }

    private function expectedOnUpdate(): string
    {
        return in_array(DB::getDriverName(), ['mariadb', 'mysql'], true)
            ? 'restrict'
            : 'no action';
    }
};
