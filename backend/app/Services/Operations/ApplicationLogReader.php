<?php

namespace App\Services\Operations;

use App\Audit\AuditPayloadSanitizer;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use SplFileObject;

final class ApplicationLogReader
{
    private const MAX_ENTRIES = 5000;

    public function __construct(private readonly AuditPayloadSanitizer $sanitizer) {}

    /**
     * @param  array<string, mixed>  $filters
     * @return array{data: array<int, array<string, mixed>>, meta: array<string, mixed>}
     */
    public function read(array $filters): array
    {
        $entries = [];
        $directory = (string) config('logging.application_log_viewer_path', storage_path('logs'));
        $files = is_dir($directory)
            ? collect(File::glob($directory.DIRECTORY_SEPARATOR.'laravel*.log'))->sortDesc()->take(31)
            : collect();

        foreach ($files as $path) {
            $file = new SplFileObject($path, 'r');
            while (! $file->eof() && count($entries) < self::MAX_ENTRIES) {
                $entry = $this->parseLine(trim((string) $file->fgets()), basename($path));
                if ($entry !== null) {
                    $entries[] = $entry;
                }
            }
        }

        usort($entries, fn (array $left, array $right): int => strcmp($right['timestamp'], $left['timestamp']));
        $filtered = array_values(array_filter($entries, fn (array $entry): bool => $this->matches($entry, $filters)));

        $counts = ['FATAL' => 0, 'ERROR' => 0, 'WARN' => 0, 'INFO' => 0];
        foreach ($filtered as $entry) {
            $counts[$entry['level']]++;
        }

        $page = (int) ($filters['page'] ?? 1);
        $perPage = (int) ($filters['per_page'] ?? 50);
        $total = count($filtered);
        $totalPages = max(1, (int) ceil($total / $perPage));

        return [
            'data' => array_slice($filtered, ($page - 1) * $perPage, $perPage),
            'meta' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'total_pages' => $totalPages,
                'level_counts' => $counts,
                'truncated' => count($entries) >= self::MAX_ENTRIES,
            ],
        ];
    }

    /** @return array<string, mixed>|null */
    private function parseLine(string $line, string $source): ?array
    {
        if (! preg_match('/^\[(?<timestamp>[^\]]+)]\s+(?<environment>[^.\s]+)\.(?<level>[A-Z]+):\s+(?<body>.*)$/', $line, $matches)) {
            return null;
        }

        [$message, $context] = $this->splitContext($matches['body']);
        $level = $this->normalizeLevel($matches['level']);
        $actor = $context['actor_username'] ?? $context['actor'] ?? null;
        $ipAddress = $context['ip_address'] ?? $context['ip'] ?? null;

        return [
            'id' => hash('sha256', $source.'|'.$matches['timestamp'].'|'.$line),
            'timestamp' => Carbon::parse($matches['timestamp'])->toISOString(),
            'level' => $level,
            'environment' => $matches['environment'],
            'message' => $this->redactMessage($message),
            'context' => $this->sanitizer->sanitize($context),
            'actor' => is_scalar($actor) ? (string) $actor : null,
            'ip_address' => is_scalar($ipAddress) ? (string) $ipAddress : null,
            'source' => $source,
        ];
    }

    /** @return array{string, array<string, mixed>} */
    private function splitContext(string $body): array
    {
        if (preg_match('/^(?<message>.*?)(?:\s+(?<context>\{.*\}))$/', $body, $parts)) {
            $decoded = json_decode($parts['context'], true);
            if (is_array($decoded)) {
                return [trim($parts['message']), $decoded];
            }
        }

        return [trim($body), []];
    }

    private function normalizeLevel(string $level): string
    {
        return match ($level) {
            'EMERGENCY', 'ALERT', 'CRITICAL' => 'FATAL',
            'WARNING' => 'WARN',
            'ERROR' => 'ERROR',
            default => 'INFO',
        };
    }

    private function redactMessage(string $message): string
    {
        return (string) preg_replace(
            '/\b(password|token|authorization|cookie|session|csrf|xsrf|otp|api[_-]?key|credential|secret|private[_-]?key)\b\s*[:=]\s*(?:"[^"]*"|\'[^\']*\'|[^\s,}]+)/i',
            '$1=[REDACTED]',
            $message,
        );
    }

    /** @param array<string, mixed> $entry @param array<string, mixed> $filters */
    private function matches(array $entry, array $filters): bool
    {
        if (($filters['level'] ?? null) && $entry['level'] !== $filters['level']) {
            return false;
        }

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $haystack = implode(' ', [$entry['message'], $entry['environment'], $entry['actor'] ?? '', $entry['source']]);
            if (! str_contains(mb_strtolower($haystack), mb_strtolower($search))) {
                return false;
            }
        }

        $date = substr($entry['timestamp'], 0, 10);

        return (! isset($filters['date_from']) || $date >= $filters['date_from'])
            && (! isset($filters['date_to']) || $date <= $filters['date_to']);
    }
}
