<?php
return ['default'=>env('CACHE_STORE','database'),'stores'=>['array'=>['driver'=>'array','serialize'=>false],'file'=>['driver'=>'file','path'=>storage_path('framework/cache/data')],'database'=>['driver'=>'database','table'=>'cache','connection'=>null,'lock_connection'=>null]],'prefix'=>env('CACHE_PREFIX','fixko_cache')];
