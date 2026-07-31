<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

class PaymentAllocationForeignKeyMigrationTest extends TestCase
{
    use RefreshDatabase;

    private const CHILD_COLUMN = 'fee_agreement_item_id';

    public function test_fresh_schema_has_the_expected_fee_agreement_item_foreign_key(): void
    {
        $this->assertSame(
            [[
                'columns' => [self::CHILD_COLUMN],
                'foreign_table' => 'fee_agreement_items',
                'foreign_columns' => ['id'],
                'on_update' => 'no action',
                'on_delete' => 'set null',
            ]],
            $this->feeAgreementItemForeignKeys(),
        );
    }

    public function test_ensure_migration_creates_the_missing_foreign_key_once(): void
    {
        $migration = $this->migration();
        $migration->down();

        $this->assertSame([], $this->feeAgreementItemForeignKeys());

        $migration->up();
        $migration->up();

        $this->assertCount(1, $this->feeAgreementItemForeignKeys());
    }

    public function test_ensure_migration_fails_closed_for_an_incompatible_foreign_key(): void
    {
        $migration = $this->migration();
        $migration->down();

        Schema::table('payment_allocations', function (Blueprint $table): void {
            $table->foreign(self::CHILD_COLUMN, 'payment_allocations_fee_agreement_item_incompatible')
                ->references('id')
                ->on('fee_items')
                ->cascadeOnDelete();
        });

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage(
            'Cannot ensure payment_allocations.fee_agreement_item_id foreign key because its existing definition does not match.',
        );

        $migration->up();
    }

    public function test_ensure_migration_down_removes_only_the_expected_foreign_key(): void
    {
        $migration = $this->migration();
        $unrelatedForeignKeys = $this->unrelatedForeignKeys();

        $migration->down();
        $migration->down();

        $this->assertSame([], $this->feeAgreementItemForeignKeys());
        $this->assertEqualsCanonicalizing($unrelatedForeignKeys, $this->unrelatedForeignKeys());
        $this->assertTrue(Schema::hasColumn('payment_allocations', self::CHILD_COLUMN));
    }

    /**
     * @return list<array{
     *     columns: list<string>,
     *     foreign_table: string,
     *     foreign_columns: list<string>,
     *     on_update: string,
     *     on_delete: string
     * }>
     */
    private function feeAgreementItemForeignKeys(): array
    {
        return array_values(array_map(
            static fn (array $foreignKey): array => [
                'columns' => $foreignKey['columns'],
                'foreign_table' => $foreignKey['foreign_table'],
                'foreign_columns' => $foreignKey['foreign_columns'],
                'on_update' => $foreignKey['on_update'],
                'on_delete' => $foreignKey['on_delete'],
            ],
            array_filter(
                Schema::getForeignKeys('payment_allocations'),
                static fn (array $foreignKey): bool => in_array(
                    self::CHILD_COLUMN,
                    $foreignKey['columns'],
                    true,
                ),
            ),
        ));
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function unrelatedForeignKeys(): array
    {
        return array_values(array_filter(
            Schema::getForeignKeys('payment_allocations'),
            static fn (array $foreignKey): bool => ! in_array(
                self::CHILD_COLUMN,
                $foreignKey['columns'],
                true,
            ),
        ));
    }

    private function migration(): object
    {
        return require database_path(
            'migrations/2026_06_30_000006_ensure_payment_allocation_fee_agreement_item_foreign_key.php',
        );
    }
}
