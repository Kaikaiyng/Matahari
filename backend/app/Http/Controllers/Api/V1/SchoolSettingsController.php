<?php

namespace App\Http\Controllers\Api\V1;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Services\SchoolSettings\SchoolSettingsService;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SchoolSettingsController extends Controller
{
    public function schoolInformation(Request $request, SchoolSettingsService $service): JsonResponse
    {
        return response()->json(['data' => $service->schoolInformation(SchoolContext::fromRequest($request)->schoolId)]);
    }

    public function updateSchoolInformation(Request $request, SchoolSettingsService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $this->nullableTrimmed($request->validate([
            'name' => ['required', 'string', 'max:255'],
            'registration_number' => ['nullable', 'string', 'max:100'],
            'group_member_line' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:2000'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'operating_hours' => ['nullable', 'string', 'max:255'],
        ]));

        return response()->json(['data' => $service->updateSchoolInformation(
            SchoolContext::fromRequest($request)->schoolId,
            $data,
            $contexts->fromRequest($request),
        )]);
    }

    public function appSupport(Request $request, SchoolSettingsService $service): JsonResponse
    {
        return response()->json(['data' => $service->appSupport(SchoolContext::fromRequest($request)->schoolId)]);
    }

    public function updateAppSupport(Request $request, SchoolSettingsService $service, AuditContextFactory $contexts): JsonResponse
    {
        $data = $this->nullableTrimmed($request->validate([
            'call_phone' => ['nullable', 'string', 'max:50'],
            'whatsapp_phone' => ['nullable', 'string', 'max:50'],
            'support_email' => ['nullable', 'email', 'max:255'],
            'operating_hours' => ['nullable', 'string', 'max:255'],
        ]));

        return response()->json(['data' => $service->updateAppSupport(
            SchoolContext::fromRequest($request)->schoolId,
            $request->user()->id,
            $data,
            $contexts->fromRequest($request),
        )]);
    }

    /** @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    private function nullableTrimmed(array $data): array
    {
        return collect($data)->map(fn (mixed $value): mixed => is_string($value) ? (trim($value) ?: null) : $value)->all();
    }
}
