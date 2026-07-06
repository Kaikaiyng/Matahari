<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreStudentRequest extends FormRequest
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
        $schoolId = $this->input('school_id', $this->user()?->school_id);

        return [
            'school_id' => ['nullable', 'integer', 'exists:schools,id'],
            'class_id' => ['nullable', 'integer', 'exists:classes,id'],
            'student_no' => [
                'required',
                'string',
                'max:50',
                Rule::unique('students', 'student_no')->where('school_id', $schoolId),
            ],
            'full_name' => ['required', 'string', 'max:255'],
            'level_group' => ['required', 'string', Rule::in(['kindergarten', 'primary', 'secondary', 'stp'])],
            'gender' => ['nullable', 'string', 'max:20'],
            'dob' => ['nullable', 'date'],
            'registration_date' => ['nullable', 'date'],
            'status' => ['required', 'string', Rule::in(['active', 'withdraw', 'graduate', 'inactive'])],
            'notes' => ['nullable', 'string'],
        ];
    }
}
