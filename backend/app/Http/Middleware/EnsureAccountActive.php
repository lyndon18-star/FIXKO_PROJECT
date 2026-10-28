<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Suspended / locked accounts may sign in, but every mutating request
 * is rejected until an admin sets their status back to active.
 * Read requests (GET) still work so the dashboard stays usable.
 */
class EnsureAccountActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->isBlocked()) {
            // Blocked accounts may still use the site read-only and manage their
            // notifications — only REPORT mutations are denied until restored.
            // Note: paths are served under the api/ prefix, so match both
            // "api/reports" and "reports" explicitly.
            $path = trim($request->path(), '/');
            $isReportMutation =
                in_array($request->getMethod(), ['POST', 'PATCH', 'PUT', 'DELETE'], true) &&
                (str_starts_with($path, 'reports/') || $path === 'reports'
                    || str_starts_with($path, 'api/reports/') || $path === 'api/reports');

            if ($isReportMutation) {
                $message = $user->account_status === 'suspended'
                    ? 'Your account is suspended. You cannot submit a report for '.$user->suspensionDaysLeft().' more day(s) (until '.$user->status_until->format('M j, Y').'), unless an administrator restores it sooner.'
                    : 'Your account is locked. You cannot submit a report until an administrator unlocks it.';

                return response()->json(['message' => $message, 'code' => 'ACCOUNT_BLOCKED'], 403);
            }
        }

        return $next($request);
    }
}
