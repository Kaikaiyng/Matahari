<?php

namespace Tests\Support;

use Closure;
use RuntimeException;

final class MariaDbDestructiveTestGate
{
    public const string ALLOW = 'allow';

    public const string SKIP = 'skip';

    private const string REQUIRED_DATABASE = 'matahari_audit_test';

    /**
     * @param  Closure(): array{database: mixed, version: mixed}  $probe
     */
    public static function evaluate(
        ?string $optIn,
        string $driver,
        ?string $databaseUrl,
        string $configuredDatabase,
        Closure $probe,
    ): string {
        if ($optIn !== '1') {
            return self::SKIP;
        }

        if ($databaseUrl !== null && $databaseUrl !== '') {
            throw new RuntimeException(
                'Refusing destructive MariaDB test: DB_URL must be empty so it cannot override the named test database.',
            );
        }

        if ($driver !== 'mariadb') {
            throw new RuntimeException(
                sprintf('Refusing destructive MariaDB test: Laravel driver must be exactly mariadb; got %s.', $driver),
            );
        }

        if ($configuredDatabase !== self::REQUIRED_DATABASE) {
            throw new RuntimeException(
                sprintf(
                    'Refusing destructive MariaDB test: configured database must be exactly %s; got %s.',
                    self::REQUIRED_DATABASE,
                    $configuredDatabase,
                ),
            );
        }

        $server = $probe();
        $actualDatabase = $server['database'] ?? null;
        $serverVersion = $server['version'] ?? null;

        if ($actualDatabase !== self::REQUIRED_DATABASE) {
            throw new RuntimeException(
                sprintf(
                    'Refusing destructive MariaDB test: actual database must be exactly %s; got %s.',
                    self::REQUIRED_DATABASE,
                    var_export($actualDatabase, true),
                ),
            );
        }

        if (! is_string($serverVersion) || stripos($serverVersion, 'MariaDB') === false) {
            throw new RuntimeException(
                sprintf(
                    'Refusing destructive MariaDB test: server version must identify MariaDB; got %s.',
                    var_export($serverVersion, true),
                ),
            );
        }

        return self::ALLOW;
    }
}
