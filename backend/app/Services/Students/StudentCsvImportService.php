<?php

namespace App\Services\Students;

use App\Audit\AuditContext;
use App\Audit\AuditContextType;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Tenant;
use App\Models\User;
use App\Support\SchoolClassCatalog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use RuntimeException;

class StudentCsvImportService
{
    /** @var array<int, string> */
    public const HEADERS = [
        'student_no',
        'full_name',
        'level_group',
        'class_name',
        'gender',
        'dob',
        'registration_date',
        'status',
        'notes',
    ];

    /** @var array<int, string> */
    private const REQUIRED_HEADERS = [
        'student_no',
        'full_name',
        'level_group',
        'status',
    ];

    public function __construct(private readonly StudentMutationService $studentMutations) {}

    /**
     * @return array{
     *     rows: array<int, array<string, mixed>>,
     *     errors: array<int, array<int, string>>
     * }
     */
    public function preflight(School $school, string $path): array
    {
        if (! is_file($path) || ! is_readable($path)) {
            throw new RuntimeException('CSV must be a readable local file.');
        }
        $handle = @fopen($path, 'rb');
        if ($handle === false) {
            throw new RuntimeException("CSV file [{$path}] is not readable.");
        }

        try {
            $headerRow = fgetcsv($handle, null, ',', '"', '');
            if ($headerRow === false) {
                return ['rows' => [], 'errors' => [1 => ['CSV file is empty.']]];
            }

            $headers = array_map(
                static fn (mixed $header): string => trim((string) $header),
                $headerRow,
            );
            if (isset($headers[0])) {
                $headers[0] = preg_replace('/^\xEF\xBB\xBF/', '', $headers[0]) ?? $headers[0];
            }

            $errors = $this->headerErrors($headers);
            $unsupportedHeaders = array_values(array_diff($headers, self::HEADERS));
            $classes = SchoolClass::query()
                ->where('school_id', $school->id)
                ->where('status', 'active')
                ->get()
                ->keyBy('name');
            $rows = [];
            $studentRows = [];
            $line = 1;

            while (($values = fgetcsv($handle, null, ',', '"', '')) !== false) {
                $line++;
                if ($this->isBlankRow($values)) {
                    continue;
                }

                foreach ($values as $value) {
                    if (! mb_check_encoding((string) $value, 'UTF-8')) {
                        $errors[$line][] = 'Every value must be valid UTF-8.';
                        break;
                    }
                }
                if (count($values) !== count($headers)) {
                    $errors[$line][] = sprintf(
                        'Expected %d column(s) from the header but found %d.',
                        count($headers),
                        count($values),
                    );
                }
                foreach ($unsupportedHeaders as $header) {
                    $errors[$line][] = "Unsupported column [{$header}].";
                }

                $data = $this->rowData($headers, $values);
                $validator = Validator::make($data, [
                    'student_no' => ['required', 'string', 'max:50'],
                    'full_name' => ['required', 'string', 'max:255'],
                    'level_group' => ['required', 'string', Rule::in(['kindergarten', 'primary', 'secondary', 'stp'])],
                    'class_name' => ['nullable', 'string', 'max:100'],
                    'gender' => ['nullable', 'string', 'max:20'],
                    'dob' => ['nullable', 'date_format:Y-m-d'],
                    'registration_date' => ['nullable', 'date_format:Y-m-d'],
                    'status' => ['required', 'string', Rule::in(['active', 'withdraw', 'graduate', 'inactive'])],
                    'notes' => ['nullable', 'string'],
                ], [
                    'level_group.in' => 'level_group must be one of: kindergarten, primary, secondary, stp.',
                    'status.in' => 'status must be one of: active, withdraw, graduate, inactive.',
                    'dob.date_format' => 'dob must use a valid YYYY-MM-DD date.',
                    'registration_date.date_format' => 'registration_date must use a valid YYYY-MM-DD date.',
                ]);
                if ($validator->fails()) {
                    $errors[$line] ??= [];
                    array_push($errors[$line], ...$validator->errors()->all());
                }

                $class = null;
                if ($data['class_name'] !== null) {
                    $class = $classes->get($data['class_name']);
                    if (! $class instanceof SchoolClass) {
                        $errors[$line][] = "class_name [{$data['class_name']}] is not an active class in target school [{$school->code}].";
                    } elseif (SchoolClassCatalog::levelGroupFor($class->name) !== $data['level_group']) {
                        $errors[$line][] = "class_name [{$class->name}] does not belong to level_group [{$data['level_group']}].";
                    }
                }

                $studentNo = $data['student_no'];
                if (is_string($studentNo) && $studentNo !== '') {
                    $studentRows[$studentNo][] = $line;
                }

                $rows[$line] = [
                    'student_no' => $data['student_no'],
                    'full_name' => $data['full_name'],
                    'level_group' => $data['level_group'],
                    'class_id' => $class?->id,
                    'gender' => $data['gender'],
                    'dob' => $data['dob'],
                    'registration_date' => $data['registration_date'],
                    'status' => $data['status'],
                    'notes' => $data['notes'],
                ];
            }
        } finally {
            fclose($handle);
        }

        if ($rows === []) {
            $errors[1][] = 'CSV must contain at least one student row.';
        }

        foreach ($studentRows as $studentNo => $lineNumbers) {
            if (count($lineNumbers) < 2) {
                continue;
            }
            $message = sprintf(
                'student_no is duplicated in this file (rows %s).',
                implode(', ', $lineNumbers),
            );
            foreach ($lineNumbers as $lineNumber) {
                $errors[$lineNumber][] = $message;
            }
        }

        $existingStudentNumbers = collect(array_keys($studentRows))
            ->chunk(500)
            ->flatMap(fn ($numbers) => Student::query()
                ->where('school_id', $school->id)
                ->whereIn('student_no', $numbers->all())
                ->pluck('student_no'))
            ->unique()
            ->flip();
        foreach ($studentRows as $studentNo => $lineNumbers) {
            if (! $existingStudentNumbers->has($studentNo)) {
                continue;
            }
            foreach ($lineNumbers as $lineNumber) {
                $errors[$lineNumber][] = "student_no already exists in target school [{$school->code}].";
            }
        }

        ksort($rows);
        ksort($errors);

        return ['rows' => $rows, 'errors' => $errors];
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     */
    public function commit(Tenant $tenant, School $school, User $actor, array $rows): int
    {
        $membership = $actor->tenantMembership($tenant->id);
        $actorRoles = $actor->is_platform_owner
            ? $actor->roles()->pluck('slug')->sort()->values()->all()
            : ($membership?->roles()->pluck('slug')->sort()->values()->all() ?? []);
        $context = new AuditContext(
            requestId: (string) Str::uuid7(),
            contextType: AuditContextType::Console,
            actorId: $actor->id,
            actorUsername: $actor->username,
            actorRoles: $actorRoles,
            actorSchoolId: $school->id,
            routeName: 'students:import-csv',
        );

        return DB::transaction(function () use ($school, $rows, $context): int {
            foreach ($rows as $row) {
                $this->studentMutations->create($school->id, $row, $context);
            }

            return count($rows);
        });
    }

    /** @param array<int, string> $headers */
    private function headerErrors(array $headers): array
    {
        $errors = [];
        if (collect($headers)->duplicates()->isNotEmpty()) {
            $errors[1][] = 'CSV header names must be unique.';
        }
        foreach (self::REQUIRED_HEADERS as $requiredHeader) {
            if (! in_array($requiredHeader, $headers, true)) {
                $errors[1][] = "Required column [{$requiredHeader}] is missing.";
            }
        }
        foreach ($headers as $header) {
            if ($header === '') {
                $errors[1][] = 'CSV header names cannot be blank.';
            } elseif (! mb_check_encoding($header, 'UTF-8')) {
                $errors[1][] = 'CSV header names must be valid UTF-8.';
            }
        }

        return $errors;
    }

    /**
     * @param  array<int, string>  $headers
     * @param  array<int, string|null>  $values
     * @return array<string, string|null>
     */
    private function rowData(array $headers, array $values): array
    {
        $data = array_fill_keys(self::HEADERS, null);
        foreach ($headers as $index => $header) {
            if (! array_key_exists($header, $data)) {
                continue;
            }
            $value = trim((string) ($values[$index] ?? ''));
            $data[$header] = $value === '' ? null : $value;
        }

        return $data;
    }

    /** @param array<int, string|null> $values */
    private function isBlankRow(array $values): bool
    {
        return collect($values)->every(fn (mixed $value): bool => trim((string) $value) === '');
    }
}
