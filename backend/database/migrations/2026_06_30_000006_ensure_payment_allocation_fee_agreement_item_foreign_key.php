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
        $usesSqliteOwnershipMarker = DB::getDriverName() === 'sqlite';

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

        if (! $usesSqliteOwnershipMarker) {
            $this->createForeignKey();

            return;
        }

        $createdOwnershipIndex = false;

        if ($sqliteOwnershipIndex === null) {
            // SQLite index names are database-global, and adding the FK rebuilds this table.
            // Claim ownership before any FK mutation so a name collision cannot leave an unowned FK.
            $this->createSqliteOwnershipIndex();
            $createdOwnershipIndex = true;
        }

        try {
            $this->createForeignKey();
        } catch (Throwable $foreignKeyFailure) {
            if ($createdOwnershipIndex) {
                $this->cleanupAfterFailedSqliteForeignKeyCreation($foreignKeyFailure);
            }

            throw $foreignKeyFailure;
        }
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

    private function createForeignKey(): void
    {
        Schema::table('payment_allocations', function (Blueprint $table): void {
            $table->foreign(self::CHILD_COLUMN, self::CONSTRAINT_NAME)
                ->references('id')
                ->on('fee_agreement_items')
                ->nullOnDelete();
        });
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

        if (! $this->matchesSqliteOwnershipIndex($ownershipIndex)) {
            throw new RuntimeException(
                'Cannot remove payment_allocations.fee_agreement_item_id foreign key because its SQLite-owned definition does not match.',
            );
        }

        if ($foreignKeys === []) {
            $this->dropSqliteOwnershipIndex();

            return;
        }

        if (count($foreignKeys) !== 1 || ! $this->matchesExpectedDefinition($foreignKeys[0])) {
            throw new RuntimeException(
                'Cannot remove payment_allocations.fee_agreement_item_id foreign key because its SQLite-owned definition does not match.',
            );
        }

        Schema::table('payment_allocations', function (Blueprint $table): void {
            $table->dropForeign([self::CHILD_COLUMN]);
            $table->dropIndex(self::SQLITE_OWNERSHIP_INDEX);
        });
    }

    private function createSqliteOwnershipIndex(): void
    {
        Schema::table('payment_allocations', function (Blueprint $table): void {
            $table->index(self::CHILD_COLUMN, self::SQLITE_OWNERSHIP_INDEX);
        });
    }

    private function dropSqliteOwnershipIndex(): void
    {
        Schema::table('payment_allocations', function (Blueprint $table): void {
            $table->dropIndex(self::SQLITE_OWNERSHIP_INDEX);
        });
    }

    private function cleanupAfterFailedSqliteForeignKeyCreation(Throwable $foreignKeyFailure): void
    {
        try {
            $foreignKeys = $this->foreignKeysForChildColumn();

            if ($foreignKeys !== []) {
                if (count($foreignKeys) !== 1 || ! $this->matchesExpectedDefinition($foreignKeys[0])) {
                    throw new RuntimeException(
                        'The failed SQLite FK stage left an incompatible child-column constraint.',
                    );
                }

                Schema::table('payment_allocations', function (Blueprint $table): void {
                    $table->dropForeign([self::CHILD_COLUMN]);
                });
            }

            $ownershipIndex = $this->sqliteOwnershipIndex();

            if ($ownershipIndex !== null) {
                if (! $this->matchesSqliteOwnershipIndex($ownershipIndex)) {
                    throw new RuntimeException(
                        'The failed SQLite FK stage left an incompatible ownership marker.',
                    );
                }

                $this->dropSqliteOwnershipIndex();
            }

            if ($this->foreignKeysForChildColumn() !== [] || $this->sqliteOwnershipIndex() !== null) {
                throw new RuntimeException(
                    'The failed SQLite FK stage left residual migration-owned schema state.',
                );
            }
        } catch (Throwable $cleanupFailure) {
            throw new RuntimeException(
                'Cannot recover from failed SQLite payment allocation FK creation; cleanup did not complete. '
                .'Original error: '.$foreignKeyFailure->getMessage()
                .'; cleanup error: '.$cleanupFailure->getMessage(),
                previous: $cleanupFailure,
            );
        }
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
