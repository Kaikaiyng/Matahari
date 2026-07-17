<?php

namespace App\Http\Requests;

use App\Models\SchoolClass;
use App\Support\SchoolClassCatalog;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateStudentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $student = $this->route('student');
        $schoolId = $student?->school_id ?? $this->user()?->school_id;

        return [
            'class_id' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('classes', 'id')->where(fn ($query) => $query
                    ->where('school_id', $schoolId)
                    ->where('status', 'active')),
            ],
            'student_no' => [
                'sometimes',
                'required',
                'string',
                'max:50',
                Rule::unique('students', 'student_no')
                    ->where('school_id', $schoolId)
                    ->ignore($student?->id),
            ],
            'full_name' => ['sometimes', 'required', 'string', 'max:255'],
            'level_group' => ['sometimes', 'required', 'string', Rule::in(['kindergarten', 'primary', 'secondary', 'stp'])],
            'gender' => ['sometimes', 'nullable', 'string', 'max:20'],
            'dob' => ['sometimes', 'nullable', 'date'],
            'registration_date' => ['sometimes', 'nullable', 'date'],
            'notes' => ['sometimes', 'nullable', 'string'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $student = $this->route('student');
            $classId = $this->input('class_id', $student?->class_id);
            $levelGroup = $this->input('level_group', $student?->level_group);

            if (! $classId || ! $levelGroup) {
                return;
            }

            $schoolClass = SchoolClass::query()->find($classId);

            if ($schoolClass && SchoolClassCatalog::levelGroupFor($schoolClass->name) !== $levelGroup) {
                $validator->errors()->add('class_id', 'The selected class does not belong to this level group.');
            }
        });
    }
}
