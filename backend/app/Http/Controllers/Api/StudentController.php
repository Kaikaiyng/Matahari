<?php

namespace App\Http\Controllers\Api;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreStudentRequest;
use App\Http\Requests\UpdateStudentRequest;
use App\Models\Student;
use App\Services\Students\StudentMutationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class StudentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $schoolId = $this->schoolId($request);

        $students = Student::query()
            ->with('class')
            ->where('school_id', $schoolId)
            ->when(
                $request->query('status', 'active') !== 'all',
                fn ($query) => $query->where('status', $request->query('status', 'active')),
            )
            ->when($request->query('level_group'), fn ($query, $levelGroup) => $query->where('level_group', $levelGroup))
            ->when($request->query('class_id'), fn ($query, $classId) => $query->where('class_id', $classId))
            ->when($request->query('student_no'), fn ($query, $studentNo) => $query->whereLike('student_no', '%'.$studentNo.'%'))
            ->when($request->query('search'), function ($query, $search): void {
                $query->where(function ($inner) use ($search): void {
                    $inner->whereLike('student_no', '%'.$search.'%')
                        ->orWhereLike('full_name', '%'.$search.'%');
                });
            })
            ->orderBy('student_no')
            ->get()
            ->map(fn (Student $student) => $this->studentSummary($student));

        return response()->json(['data' => $students]);
    }

    public function store(
        StoreStudentRequest $request,
        StudentMutationService $service,
        AuditContextFactory $contextFactory,
    ): JsonResponse {
        $data = $request->validated();
        $schoolId = $this->schoolId($request, $data['school_id'] ?? null);

        unset($data['school_id']);

        $student = $service->create($schoolId, $data, $contextFactory->fromRequest($request));

        return response()->json(['student' => $this->studentDetail($student->load(['class', 'parents']))], 201);
    }

    public function show(Request $request, Student $student): JsonResponse
    {
        $this->assertSchoolScope($request, $student);

        return response()->json([
            'student' => $this->studentDetail($student->load(['class', 'parents', 'feeAgreements.items', 'feeAgreements.discounts'])),
        ]);
    }

    public function update(
        UpdateStudentRequest $request,
        Student $student,
        StudentMutationService $service,
        AuditContextFactory $contextFactory,
    ): JsonResponse {
        $this->assertSchoolScope($request, $student);

        $student = $service->update(
            $student,
            $request->safe()->except('status'),
            $contextFactory->fromRequest($request),
        );

        return response()->json(['student' => $this->studentDetail($student->fresh(['class', 'parents']))]);
    }

    private function schoolId(Request $request, ?int $requestedSchoolId = null): int
    {
        $userSchoolId = $request->user()?->school_id;
        $schoolId = $userSchoolId ?: $requestedSchoolId;

        if (! $schoolId) {
            throw ValidationException::withMessages(['school_id' => 'School is required.']);
        }

        return (int) $schoolId;
    }

    private function assertSchoolScope(Request $request, Student $student): void
    {
        $userSchoolId = $request->user()?->school_id;

        if ($userSchoolId && (int) $student->school_id !== (int) $userSchoolId) {
            abort(403, 'Student belongs to a different school.');
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function studentSummary(Student $student): array
    {
        return [
            'id' => $student->id,
            'student_no' => $student->student_no,
            'full_name' => $student->full_name,
            'level_group' => $student->level_group,
            'class' => $student->class ? [
                'id' => $student->class->id,
                'name' => $student->class->name,
            ] : null,
            'fee_amount' => null,
            'outstanding_balance' => null,
            'status' => $student->status,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function studentDetail(Student $student): array
    {
        return [
            ...$this->studentSummary($student),
            'gender' => $student->gender,
            'dob' => $student->dob?->toDateString(),
            'registration_date' => $student->registration_date?->toDateString(),
            'notes' => $student->notes,
            'parents' => $student->parents->map(fn ($parent) => [
                'id' => $parent->id,
                'full_name' => $parent->full_name,
                'phone' => $parent->phone,
                'email' => $parent->email,
                'relationship' => $parent->pivot?->relationship,
                'is_primary_contact' => (bool) $parent->pivot?->is_primary_contact,
            ])->values(),
        ];
    }
}
