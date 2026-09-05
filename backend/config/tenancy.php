<?php

return [
    'mode' => env('TENANCY_MODE'),
    'dedicated_tenant_slug' => env('TENANCY_DEDICATED_TENANT_SLUG'),
    'local_hosts' => ['localhost', '127.0.0.1'],
    'default_tenant_slug' => env('TENANCY_LOCAL_TENANT_SLUG'),
];
