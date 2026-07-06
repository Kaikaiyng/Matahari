<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FeeItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class FeeItemController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $schoolId = $request->user()?->school_id ?: $request->query('school_id');

        if (! $schoolId) {
            throw ValidationException::withMessages(['school_id' => 'School is required.']);
        }

        $items = FeeItem::query()
            ->where('school_id', $schoolId)
            ->where('status', 'active')
            ->orderBy('category')
            ->orderBy('name')
            ->get()
            ->map(fn (FeeItem $item) => [
                'id' => $item->id,
                'code' => $item->code,
                'name' => $item->name,
                'category' => $item->category,
                'fee_type' => $item->fee_type,
                'default_amount' => (float) $item->default_amount,
            ]);

        return response()->json(['data' => $items]);
    }
}
