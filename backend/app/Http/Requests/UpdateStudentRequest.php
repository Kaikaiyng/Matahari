<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'class_id' => ['sometimes', 'nullable', 'integer', 'exists:classes,id'],
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
}
