<?php
return [
    'default' => env('LOG_CHANNEL', 'stack'),
    'channels' => [
        'stack' => ['driver'=>'stack','channels'=>['single'],'ignore_exceptions'=>false],
        'single' => ['driver'=>'single','path'=>storage_path('logs/laravel.log'),'level'=>env('LOG_LEVEL','debug'),'replace_placeholders'=>true],
        'stderr' => ['driver'=>'monolog','level'=>env('LOG_LEVEL','debug'),'handler'=>Monolog\Handler\StreamHandler::class,'with'=>['stream'=>'php://stderr'],'formatter'=>env('LOG_STDERR_FORMATTER')],
    ],
];
