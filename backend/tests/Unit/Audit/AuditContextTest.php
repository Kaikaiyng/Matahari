<?php

namespace Tests\Unit\Audit;

use App\Audit\AuditContext;
use App\Audit\AuditContextType;
use Illuminate\Support\Str;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class AuditContextTest extends TestCase
{
    #[DataProvider('invalidRequestIds')]
    public function test_request_id_must_be_uuidv7(string $requestId): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Audit request ID must be a UUIDv7.');

        new AuditContext(
            requestId: $requestId,
            contextType: AuditContextType::System,
        );
    }

    public function test_uuidv7_request_id_is_preserved(): void
    {
        $requestId = (string) Str::uuid7();

        $context = new AuditContext(
            requestId: $requestId,
            contextType: AuditContextType::System,
        );

        $this->assertSame($requestId, $context->requestId);
    }

    /**
     * @return array<string, array{string}>
     */
    public static function invalidRequestIds(): array
    {
        return [
            'malformed' => ['not-a-uuid'],
            'uuidv4' => ['550e8400-e29b-41d4-a716-446655440000'],
        ];
    }
}
