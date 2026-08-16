<?php

namespace App\Http\Controllers\Api;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Services\Billing\PaymentReminderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PaymentReminderController extends Controller
{
    public function store(
        Request $request,
        Student $student,
        PaymentReminderService $service,
        AuditContextFactory $contextFactory,
    ): JsonResponse {
        if ((int) $student->school_id !== (int) $request->user()->school_id) {
            abort(403, 'Student belongs to a different school.');
        }

        $result = $service->send($student, $request->user(), $contextFactory->fromRequest($request));

        return response()->json(['data' => $result], 201);
    }
}
