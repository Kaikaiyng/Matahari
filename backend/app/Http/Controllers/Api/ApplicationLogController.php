<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\IndexApplicationLogRequest;
use App\Services\Operations\ApplicationLogReader;
use Illuminate\Http\JsonResponse;

class ApplicationLogController extends Controller
{
    public function index(IndexApplicationLogRequest $request, ApplicationLogReader $reader): JsonResponse
    {
        return response()->json($reader->read($request->validated()));
    }
}
