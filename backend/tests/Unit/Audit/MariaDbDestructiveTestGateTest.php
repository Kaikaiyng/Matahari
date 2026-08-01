<?php

namespace Tests\Unit\Audit;

require_once __DIR__.'/../../Support/MariaDbDestructiveTestGate.php';

use PHPUnit\Framework\TestCase;
use RuntimeException;
use Tests\Support\MariaDbDestructiveTestGate;

class MariaDbDestructiveTestGateTest extends TestCase
{
    public function test_without_explicit_opt_in_it_skips_without_connecting(): void
    {
        $probeWasCalled = false;

        $decision = MariaDbDestructiveTestGate::evaluate(
            optIn: null,
            driver: 'sqlite',
            databaseUrl: null,
            configuredDatabase: ':memory:',
            probe: function () use (&$probeWasCalled): array {
                $probeWasCalled = true;

                return [];
            },
        );

        $this->assertSame(MariaDbDestructiveTestGate::SKIP, $decision);
        $this->assertFalse($probeWasCalled);
    }

    public function test_explicit_opt_in_rejects_a_non_mariadb_driver_before_connecting(): void
    {
        $probeWasCalled = false;

        try {
            MariaDbDestructiveTestGate::evaluate(
                optIn: '1',
                driver: 'mysql',
                databaseUrl: null,
                configuredDatabase: 'matahari_audit_test',
                probe: function () use (&$probeWasCalled): array {
                    $probeWasCalled = true;

                    return [];
                },
            );

            $this->fail('The destructive gate should reject MySQL.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('mariadb', strtolower($exception->getMessage()));
            $this->assertFalse($probeWasCalled);
        }
    }

    public function test_explicit_opt_in_rejects_a_database_url_before_connecting(): void
    {
        $probeWasCalled = false;

        try {
            MariaDbDestructiveTestGate::evaluate(
                optIn: '1',
                driver: 'mariadb',
                databaseUrl: 'mariadb://root@localhost/production',
                configuredDatabase: 'matahari_audit_test',
                probe: function () use (&$probeWasCalled): array {
                    $probeWasCalled = true;

                    return [];
                },
            );

            $this->fail('The destructive gate should reject DB_URL overrides.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('DB_URL', $exception->getMessage());
            $this->assertFalse($probeWasCalled);
        }
    }

    public function test_explicit_opt_in_rejects_a_whitespace_database_url(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('DB_URL');

        MariaDbDestructiveTestGate::evaluate(
            optIn: '1',
            driver: 'mariadb',
            databaseUrl: '   ',
            configuredDatabase: 'matahari_audit_test',
            probe: fn (): array => [
                'database' => 'matahari_audit_test',
                'version' => '11.4.2-MariaDB',
            ],
        );
    }

    public function test_explicit_opt_in_rejects_the_wrong_configured_database_before_connecting(): void
    {
        $probeWasCalled = false;

        try {
            MariaDbDestructiveTestGate::evaluate(
                optIn: '1',
                driver: 'mariadb',
                databaseUrl: null,
                configuredDatabase: 'matahari',
                probe: function () use (&$probeWasCalled): array {
                    $probeWasCalled = true;

                    return [];
                },
            );

            $this->fail('The destructive gate should reject a non-test configured database.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('configured database', strtolower($exception->getMessage()));
            $this->assertFalse($probeWasCalled);
        }
    }

    public function test_explicit_opt_in_rejects_the_wrong_actual_database(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('actual database');

        MariaDbDestructiveTestGate::evaluate(
            optIn: '1',
            driver: 'mariadb',
            databaseUrl: null,
            configuredDatabase: 'matahari_audit_test',
            probe: fn (): array => [
                'database' => 'matahari',
                'version' => '11.4.2-MariaDB',
            ],
        );
    }

    public function test_explicit_opt_in_rejects_a_non_mariadb_server(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('server version');

        MariaDbDestructiveTestGate::evaluate(
            optIn: '1',
            driver: 'mariadb',
            databaseUrl: null,
            configuredDatabase: 'matahari_audit_test',
            probe: fn (): array => [
                'database' => 'matahari_audit_test',
                'version' => '8.4.0 MySQL Community Server',
            ],
        );
    }

    public function test_explicit_opt_in_allows_only_the_expected_mariadb_database(): void
    {
        $decision = MariaDbDestructiveTestGate::evaluate(
            optIn: '1',
            driver: 'mariadb',
            databaseUrl: '',
            configuredDatabase: 'matahari_audit_test',
            probe: fn (): array => [
                'database' => 'matahari_audit_test',
                'version' => '11.4.2-MariaDB',
            ],
        );

        $this->assertSame(MariaDbDestructiveTestGate::ALLOW, $decision);
    }
}
