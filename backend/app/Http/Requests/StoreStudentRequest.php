<?php

namespace App\Http\Requests;

use App\Models\SchoolClass;
use App\Support\SchoolClassCatalog;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

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
        $schoolId = $this->user()?->school_id ?: $this->input('school_id');

        return [
            'school_id' => ['nullable', 'integer', 'exists:schools,id'],
            'class_id' => [
                'nullable',
                'integer',
                Rule::exists('classes', 'id')->where(fn ($query) => $query
                    ->where('school_id', $schoolId)
                    ->where('status', 'active')),
            ],
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

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if (! $this->filled('class_id') || ! $this->filled('level_group')) {
                return;
            }

            $schoolClass = SchoolClass::query()->find($this->integer('class_id'));

            if ($schoolClass && SchoolClassCatalog::levelGroupFor($schoolClass->name) !== $this->string('level_group')->toString()) {
                $validator->errors()->add('class_id', 'The selected class does not belong to this level group.');
            }
        });
    }
}
