<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

class DeploymentInfoController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $label = match (config('deployment.mode')) {
            'staging' => 'STAGING',
            'prelaunch-production' => 'PRE-LAUNCH DEMO',
            default => '',
        };

        return response()->json(['environment_label' => $label]);
    }
}
