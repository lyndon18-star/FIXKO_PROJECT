<?php
namespace App\Http\Middleware;
use Closure;
use Illuminate\Http\Request;
class EnsureRole
{
    public function handle(Request $request, Closure $next, ...$roles)
    {
        abort_unless($request->user() && in_array($request->user()->role, $roles, true), 403, 'Insufficient permissions.');
        return $next($request);
    }
}
