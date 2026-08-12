<?php

return [
    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_unique(array_filter([
        env('ADMIN_FRONTEND_URL', env('FRONTEND_URL', 'http://localhost:5173')),
        env('ADMIN_FRONTEND_URL_ALT', env('FRONTEND_URL_ALT', 'http://127.0.0.1:5173')),
        env('MOBILE_APP_URL', 'http://localhost:5174'),
        env('MOBILE_APP_URL_ALT', 'http://127.0.0.1:5174'),
    ]))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,
];
