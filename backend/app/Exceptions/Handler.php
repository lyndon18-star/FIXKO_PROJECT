<?php
namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\Request;

class Handler extends ExceptionHandler
{
    protected function unauthenticated($request, AuthenticationException $exception)
    {
        if ($request instanceof Request && ($request->is('api/*') || $request->expectsJson())) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        return redirect()->guest($exception->redirectTo($request) ?? route('login'));
    }
}
