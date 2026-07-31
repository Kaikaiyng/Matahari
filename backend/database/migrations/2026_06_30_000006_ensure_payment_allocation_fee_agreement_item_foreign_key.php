<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const CHILD_COLUMN = 'fee_agreement_item_id';

    private const CONSTRAINT_NAME = 'payment_allocations_fee_agreement_item_ensured_foreign';

    private const SQLITE_OWNERSHIP_INDEX = 'payment_allocations_fee_agreement_item_ensured_marker';

    public function up(): void
    {
        $foreignKeys = $this->foreignKeysForChildColumn();
        $sqliteOwnershipIndex = $this->sqliteOwnershipIndex();

        if ($sqliteOwnershipIndex !== null && ! $this->matchesSqliteOwnershipIndex($sqliteOwnershipIndex)) {
            throw new RuntimeException(
                'Cannot ensure payment_allocations.fee_agreement_item_id foreign key because its SQLite ownership marker does not match.',
            );
        }

        if (count($foreignKeys) === 1 && $this->matchesExpectedDefinition($foreignKeys[0])) {
            return;
        }

        if ($foreignKeys !== []) {
            throw new RuntimeException(
                'Cannot ensure payment_allocations.fee_agreement_item_id foreign key because its existing definition does not match.',
            );
        }

        if ($sqliteOwnershipIndex !== null) {
            throw new RuntimeException(
                'Cannot ensure payment_allocations.fee_agreement_item_id foreign key because its SQLite ownership marker exists without the expected constraint.',
            );
        }

        $usesSqliteOwnershipMarker = DB::getDriverName() === 'sqlite';

        Schema::table('payment_allocations', function (Blueprint $table) use ($usesSqliteOwnershipMarker): void {
            $table->foreign(self::CHILD_COLUMN, self::CONSTRAINT_NAME)
                ->references('id')
                ->on('fee_agreement_items')
                ->nullOnDelete();

            if ($usesSqliteOwnershipMarker) {
                $table->index(self::CHILD_COLUMN, self::SQLITE_OWNERSHIP_INDEX);
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('payment_allocations', self::CHILD_COLUMN)) {
            return;
        }

        $foreignKeys = $this->foreignKeysForChildColumn();

        if (DB::getDriverName() === 'sqlite') {
            $this->removeOwnedSqliteForeignKey($foreignKeys);

            return;
        }

        $ownedForeignKeys = array_values(array_filter(
            $foreignKeys,
            static fn (array $foreignKey): bool => strtolower((string) $foreignKey['name']) === self::CONSTRAINT_NAME,
        ));

        if ($ownedForeignKeys === []) {
            return;
        }

        if (count($ownedForeignKeys) !== 1
            || count($foreignKeys) !== 1
            || ! $this->matchesExpectedDefinition($ownedForeignKeys[0])) {
            throw new RuntimeException(
                'Cannot remove payment_allocations.fee_agreement_item_id foreign key because its existing definition does not match.',
            );
        }

        $identifier = $ownedForeignKeys[0]['name'];

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

    /**
     * @param  list<array{
     *     name: string|null,
     *     columns: list<string>,
     *     foreign_schema: string|null,
     *     foreign_table: string,
     *     foreign_columns: list<string>,
     *     on_update: string,
     *     on_delete: string
     * }>  $foreignKeys
     */
    private function removeOwnedSqliteForeignKey(array $foreignKeys): void
    {
        $ownershipIndex = $this->sqliteOwnershipIndex();

        if ($ownershipIndex === null) {
            return;
        }

        if (! $this->matchesSqliteOwnershipIndex($ownershipIndex)
            || count($foreignKeys) !== 1
            || ! $this->matchesExpectedDefinition($foreignKeys[0])) {
            throw new RuntimeException(
                'Cannot remove payment_allocations.fee_agreement_item_id foreign key because its SQLite-owned definition does not match.',
            );
        }

        Schema::table('payment_allocations', function (Blueprint $table): void {
            $table->dropForeign([self::CHILD_COLUMN]);
            $table->dropIndex(self::SQLITE_OWNERSHIP_INDEX);
        });
    }

    /**
     * @return array{name: string, columns: list<string>, type: string|null, unique: bool, primary: bool}|null
     */
    private function sqliteOwnershipIndex(): ?array
    {
        if (DB::getDriverName() !== 'sqlite') {
            return null;
        }

        foreach (Schema::getIndexes('payment_allocations') as $index) {
            if ($index['name'] === self::SQLITE_OWNERSHIP_INDEX) {
                return $index;
            }
        }

        return null;
    }

    /**
     * @param  array{name: string, columns: list<string>, type: string|null, unique: bool, primary: bool}  $index
     */
    private function matchesSqliteOwnershipIndex(array $index): bool
    {
        $type = $index['type'] === null ? null : strtolower($index['type']);

        return array_map('strtolower', $index['columns']) === [self::CHILD_COLUMN]
            && $index['unique'] === false
            && $index['primary'] === false
            && ($type === null || $type === 'btree');
    }
};
