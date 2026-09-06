<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Guardian;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ParentDirectoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;
        $canViewStudents = $request->user()->hasPermissionTo('students.view', $schoolId);
        if (! $canViewStudents && $request->filled('class_id')) {
            abort(403, 'Student details require Students View access.');
        }
        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:150'],
            'class_id' => ['nullable', 'integer', Rule::exists('classes', 'id')->where('school_id', $schoolId)],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);
        $studentScope = fn ($query) => $query->where('students.school_id', $schoolId)
            ->where('student_parent_links.school_id', $schoolId);
        $parents = Guardian::query()->where('parents.school_id', $schoolId);
        if ($canViewStudents) {
            $parents->with(['students' => fn ($query) => $studentScope($query)->withPivot('id')
                ->with(['class' => fn ($classes) => $classes->where('school_id', $schoolId)])
                ->orderBy('students.student_no')->orderBy('student_parent_links.id')]);
        }
        $search = trim($data['search'] ?? '');
        if ($search !== '') {
            $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($search)).'%';
            $parents->where(function ($query) use ($pattern, $canViewStudents, $studentScope): void {
                foreach (['parents.full_name', 'parents.phone', 'parents.email'] as $column) {
                    $query->orWhereRaw("LOWER({$column}) LIKE ? ESCAPE '!'", [$pattern]);
                }
                if ($canViewStudents) {
                    $query->orWhereHas('students', fn ($students) => $studentScope($students)->where(fn ($names) => $names
                        ->whereRaw("LOWER(students.full_name) LIKE ? ESCAPE '!'", [$pattern])
                        ->orWhereRaw("LOWER(students.student_no) LIKE ? ESCAPE '!'", [$pattern])));
                }
            });
        }
        if (isset($data['class_id'])) {
            $parents->whereHas('students', fn ($query) => $studentScope($query)->where('students.class_id', $data['class_id']));
        }
        $page = $parents->orderBy('parents.full_name')->orderBy('parents.id')->paginate($data['per_page'] ?? 25);

        return response()->json([
            'data' => $page->getCollection()->map(fn (Guardian $parent) => [
                'id' => $parent->id, 'name' => $parent->full_name,
                'phone' => $parent->phone, 'email' => $parent->email, 'address' => $parent->address,
                'account_linked' => $parent->user_id !== null,
                'children' => $canViewStudents ? $parent->students->map(fn (Student $student) => [
                    'id' => $student->id, 'link_id' => $student->pivot->id,
                    'student_no' => $student->student_no, 'name' => $student->full_name,
                    'class_name' => $student->class?->name,
                    'relationship' => $student->pivot->relationship,
                    'relationship_status' => $student->pivot->status,
                ]) : [],
            ]),
            'meta' => [
                'total' => $page->total(), 'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(), 'per_page' => $page->perPage(),
                'can_view_students' => $canViewStudents,
                'class_options' => $canViewStudents
                    ? SchoolClass::query()->where('school_id', $schoolId)->orderBy('name')->get(['id', 'name']) : [],
            ],
        ]);
    }
}
