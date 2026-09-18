<?php

use Illuminate\Support\Facades\Artisan;

Artisan::command('fixko:about', function () {
    $this->info('Fixko API');
})->purpose('Display application information');
