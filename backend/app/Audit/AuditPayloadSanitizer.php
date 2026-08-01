<?php

namespace App\Audit;

use InvalidArgumentException;

final class AuditPayloadSanitizer
{
    private const PROHIBITED_ENVELOPES = [
        'headers',
        'rawbody',
        'requestbody',
        'files',
        'fileuploads',
        'filecontents',
    ];

    private const BENIGN_KEYS = [
        'tokencount',
        'sessionduration',
        'cookiepolicy',
    ];

    private const SENSITIVE_FRAGMENTS = [
        'password',
        'token',
        'authorization',
        'cookie',
        'session',
        'csrf',
        'xsrf',
        'otp',
        'apikey',
        'credential',
        'secret',
        'privatekey',
    ];

    /**
     * @param  array<array-key, mixed>  $payload
     * @return array<array-key, mixed>
     */
    public function sanitize(array $payload): array
    {
        $sanitized = [];

        foreach ($payload as $key => $value) {
            if (is_string($key) && $this->shouldDropKey($key)) {
                continue;
            }

            $sanitized[$key] = $this->sanitizeValue($value);
        }

        return $sanitized;
    }

    private function shouldDropKey(string $key): bool
    {
        $normalized = strtolower((string) preg_replace('/[^a-z0-9]/i', '', $key));

        if (in_array($normalized, self::PROHIBITED_ENVELOPES, true)) {
            return true;
        }

        if (in_array($normalized, self::BENIGN_KEYS, true)) {
            return false;
        }

        foreach (self::SENSITIVE_FRAGMENTS as $fragment) {
            if (str_contains($normalized, $fragment)) {
                return true;
            }
        }

        return false;
    }

    private function sanitizeValue(mixed $value): mixed
    {
        if (is_array($value)) {
            return $this->sanitize($value);
        }

        if (is_object($value) || is_resource($value)) {
            throw new InvalidArgumentException('Audit payload values must be scalar, null, or arrays.');
        }

        return $value;
    }
}
