<?php

namespace Tests\Unit\Audit;

use App\Audit\AuditPayloadSanitizer;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use stdClass;

class AuditPayloadSanitizerTest extends TestCase
{
    public function test_recursively_removes_mixed_case_and_nested_secrets(): void
    {
        $result = (new AuditPayloadSanitizer())->sanitize([
            'student_no' => 'MIS-001',
            'Password' => 'plain',
            'profile' => [
                'phone' => '0123',
                'remember_token' => 'secret',
                'AUTHORIZATION-header' => 'Bearer secret',
                'nested' => [
                    'csrfToken' => 'secret',
                    'safe' => true,
                ],
            ],
        ]);

        $this->assertSame([
            'student_no' => 'MIS-001',
            'profile' => [
                'phone' => '0123',
                'nested' => [
                    'safe' => true,
                ],
            ],
        ], $result);
    }

    public function test_rejects_objects_instead_of_serializing_unknown_data(): void
    {
        $this->expectException(InvalidArgumentException::class);

        (new AuditPayloadSanitizer())->sanitize(['payload' => new stdClass()]);
    }
}
