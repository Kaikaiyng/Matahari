<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Billing\InvoiceGenerationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InvoiceGenerationController extends Controller
{
    public function store(Request $request, InvoiceGenerationService $service): JsonResponse
    {
        $data = $request->validate([
            'school_id' => ['required', 'integer', 'exists:schools,id'],
            'invoice_month' => ['required', 'date_format:Y-m'],
            'issue_date' => ['required', 'date'],
            'due_date' => ['required', 'date', 'after_or_equal:issue_date'],
            'created_by' => ['nullable', 'integer', 'exists:users,id'],
            'class_id' => ['nullable', 'integer', 'exists:classes,id'],
        ]);

        $result = $service->generateMonthly(
            schoolId: (int) $data['school_id'],
            invoiceMonth: $data['invoice_month'],
            issueDate: $data['issue_date'],
            dueDate: $data['due_date'],
            createdBy: $data['created_by'] ?? null,
            classId: $data['class_id'] ?? null,
        );

        return response()->json($result, 201);
    }
}
