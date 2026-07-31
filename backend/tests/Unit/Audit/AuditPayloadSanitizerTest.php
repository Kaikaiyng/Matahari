<?php

namespace Tests\Unit\Audit;

use App\Audit\AuditPayloadSanitizer;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use stdClass;

class AuditPayloadSanitizerTest extends TestCase
{
    public function test_recursively_removes_prohibited_request_and_file_envelopes(): void
    {
        $result = (new AuditPayloadSanitizer)->sanitize([
            'student_no' => 'MIS-001',
            'HeAdErS' => 'Authorization: Bearer exposed',
            'profile' => [
                'RAW-body' => '{"password":"exposed"}',
                'request.body' => ['password' => 'exposed'],
                'FiLeS' => ['identity-card.jpg'],
                'file_uploads' => ['identity-card.jpg'],
                'FILE Contents' => 'opaque-binary-data',
                'nested' => [
                    'REQUEST_BODY' => 'opaque request body',
                    'safe' => true,
                ],
            ],
        ]);

        $this->assertSame([
            'student_no' => 'MIS-001',
            'profile' => [
                'nested' => [
                    'safe' => true,
                ],
            ],
        ], $result);
    }

    public function test_preserves_named_benign_business_fields_without_weakening_credential_redaction(): void
    {
        $result = (new AuditPayloadSanitizer)->sanitize([
            'token_count' => 12,
            'session_duration' => 3600,
            'cookie_policy' => 'strict',
            'access-token' => 'exposed',
            'password_hash' => 'exposed',
            'Authorization' => 'Bearer exposed',
            'nested' => [
                'SESSION-ID' => 'exposed',
                'client_secret' => 'exposed',
                'token_count' => 3,
            ],
        ]);

        $this->assertSame([
            'token_count' => 12,
            'session_duration' => 3600,
            'cookie_policy' => 'strict',
            'nested' => [
                'token_count' => 3,
            ],
        ], $result);
    }

    public function test_recursively_removes_mixed_case_and_nested_secrets(): void
    {
        $result = (new AuditPayloadSanitizer)->sanitize([
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

        (new AuditPayloadSanitizer)->sanitize(['payload' => new stdClass]);
    }
}
