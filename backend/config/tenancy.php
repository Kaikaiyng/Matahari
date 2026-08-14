<?php

return [
    'allow_unresolved_local_hosts' => (bool) env('TENANCY_ALLOW_UNRESOLVED_LOCAL_HOSTS', false),
    'local_hosts' => ['localhost', '127.0.0.1'],
    'default_tenant_slug' => env('TENANCY_LOCAL_TENANT_SLUG'),
];
