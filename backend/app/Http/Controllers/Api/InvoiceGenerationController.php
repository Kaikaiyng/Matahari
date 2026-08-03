<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SchoolClass;
use App\Services\Billing\InvoiceGenerationService;
use App\Support\SchoolScopeResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class InvoiceGenerationController extends Controller
{
    public function store(
        Request $request,
        InvoiceGenerationService $service,
        SchoolScopeResolver $schoolScopeResolver,
    ): JsonResponse {
        $data = $request->validate([
            'school_id' => ['sometimes', 'integer'],
            'invoice_month' => ['required', 'date_format:Y-m'],
            'issue_date' => ['required', 'date'],
            'due_date' => ['required', 'date', 'after_or_equal:issue_date'],
            'class_id' => ['nullable', 'integer', 'exists:classes,id'],
        ]);
        $schoolId = $schoolScopeResolver->resolve($request->user(), $data['school_id'] ?? null);

        if (isset($data['class_id']) && ! SchoolClass::query()
            ->whereKey($data['class_id'])
            ->where('school_id', $schoolId)
            ->exists()) {
            throw ValidationException::withMessages([
                'class_id' => 'The selected class is invalid for this school.',
            ]);
        }

        $result = $service->generateMonthly(
            schoolId: $schoolId,
            invoiceMonth: $data['invoice_month'],
            issueDate: $data['issue_date'],
            dueDate: $data['due_date'],
            createdBy: (int) $request->user()->id,
            classId: $data['class_id'] ?? null,
        );

        return response()->json($result, 201);
    }
}
