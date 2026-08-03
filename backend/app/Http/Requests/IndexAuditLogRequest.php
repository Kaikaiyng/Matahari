<?php

namespace App\Http\Requests;

use App\Audit\AuditAction;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexAuditLogRequest extends FormRequest
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
        return [
            'action' => ['nullable', Rule::enum(AuditAction::class)],
            'module' => ['nullable', Rule::enum(AuditModule::class)],
            'entity_type' => ['nullable', Rule::enum(AuditSubject::class)],
            'entity_id' => ['nullable', 'integer', 'min:1'],
            'user_id' => ['nullable', 'integer', 'min:1'],
            'school_id' => ['nullable', 'integer', 'min:1'],
            'request_id' => ['nullable', 'uuid'],
            'actor_username' => ['nullable', 'string', 'max:50'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'per_page' => ['nullable', 'integer', 'between:1,100'],
            'cursor' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
