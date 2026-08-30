<?php

namespace App\Http\Controllers\Api;

use App\Audit\AuditContextFactory;
use App\Http\Controllers\Controller;
use App\Models\FeeItem;
use App\Services\FeeItems\FeeItemService;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class FeeItemController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;

        $items = FeeItem::query()
            ->where('school_id', $schoolId)
            ->where('status', 'active')
            ->orderBy('category')
            ->orderBy('name')
            ->get()
            ->map(fn (FeeItem $item) => $this->response($item));

        return response()->json(['data' => $items]);
    }

    public function catalogue(Request $request): JsonResponse
    {
        $items = FeeItem::query()
            ->where('school_id', SchoolContext::fromRequest($request)->schoolId)
            ->orderByRaw("case when status = 'active' then 0 else 1 end")
            ->orderBy('category')
            ->orderBy('name')
            ->get()
            ->map(fn (FeeItem $item) => $this->response($item));

        return response()->json(['data' => $items]);
    }

    public function store(Request $request, FeeItemService $service, AuditContextFactory $contexts): JsonResponse
    {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;
        $request->merge(['code' => strtoupper(trim((string) $request->input('code')))]);
        $data = $request->validate($this->rules($schoolId));
        $item = $service->create($schoolId, $data, $contexts->fromRequest($request));

        return response()->json(['data' => $this->response($item)], 201);
    }

    public function update(Request $request, FeeItem $feeItem, FeeItemService $service, AuditContextFactory $contexts): JsonResponse
    {
        $schoolId = SchoolContext::fromRequest($request)->schoolId;
        abort_unless((int) $feeItem->school_id === $schoolId, 404);
        $data = $request->validate($this->rules($schoolId, $feeItem));
        if (in_array($feeItem->code, ['TUITION', 'MISC'], true)
            && ($data['category'] !== 'mandatory' || $data['fee_type'] !== 'recurring' || $data['status'] !== 'active')) {
            throw ValidationException::withMessages([
                'status' => 'Tuition Fee and Misc Fee must remain active, mandatory, recurring items because every Fee Agreement requires them.',
            ]);
        }
        $item = $service->update($schoolId, $feeItem, $data, $contexts->fromRequest($request));

        return response()->json(['data' => $this->response($item)]);
    }

    /** @return array<string, array<int, mixed>> */
    private function rules(int $schoolId, ?FeeItem $item = null): array
    {
        $rules = [
            'name' => ['required', 'string', 'max:255', Rule::unique('fee_items', 'name')->where('school_id', $schoolId)->ignore($item?->id)],
            'category' => ['required', Rule::in(['mandatory', 'optional'])],
            'fee_type' => ['required', Rule::in(['recurring', 'one_time'])],
            'default_amount' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:99999999.99'],
        ];

        if ($item) {
            $rules['status'] = ['required', Rule::in(['active', 'inactive'])];
        } else {
            $rules['code'] = ['required', 'string', 'max:50', 'regex:/^[A-Z0-9_-]+$/', Rule::unique('fee_items', 'code')->where('school_id', $schoolId)];
        }

        return $rules;
    }

    /** @return array<string, mixed> */
    private function response(FeeItem $item): array
    {
        return [
            'id' => $item->id,
            'code' => $item->code,
            'name' => $item->name,
            'category' => $item->category,
            'fee_type' => $item->fee_type,
            'default_amount' => (float) $item->default_amount,
            'status' => $item->status,
        ];
    }
}
