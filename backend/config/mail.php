<?php
return [
    'default' => env('MAIL_MAILER', 'log'),
    'mailers' => [
        'log' => ['transport' => 'log', 'channel' => env('LOG_CHANNEL', 'stack')],
        'smtp' => ['transport' => 'smtp', 'host' => env('MAIL_HOST','127.0.0.1'), 'port' => env('MAIL_PORT',587), 'encryption' => env('MAIL_ENCRYPTION','tls'), 'username' => env('MAIL_USERNAME'), 'password' => env('MAIL_PASSWORD'), 'timeout' => null],
    ],
    'from' => ['address' => env('MAIL_FROM_ADDRESS','hello@example.com'), 'name' => env('MAIL_FROM_NAME',env('APP_NAME','Fixko'))],
];
