<?php

namespace App\Http\Controllers;

use App\Models\Report;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/** Admin-only recycle bin: soft-deleted accounts and reports, restore or purge. */
class RecycleBinController extends Controller
{
    /** GET /recycle-bin — lists all soft-deleted accounts and reports so the admin can review them. */
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);

        $accounts = User::onlyTrashed()
            ->orderBy('deleted_at', 'desc')
            ->get(['id', 'name', 'email', 'first_name', 'last_name', 'school_id', 'role', 'department', 'deleted_at']);

        $reports = Report::onlyTrashed()
            ->with(['room:id,name,building', 'reporter:id,name,email,deleted_at'])
            ->orderBy('deleted_at', 'desc')
            ->get();

        return response()->json([
            'accounts' => $accounts,
            'reports' => $reports,
        ]);
    }

    /** POST /recycle-bin/restore — the Restore button: puts a deleted account or report back into active use. */
    public function restore(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate([
            'type' => ['required', 'in:account,report'],
            'id' => ['required'],
        ]);

        if ($data['type'] === 'account') {
            /** @var User|null $user */
            $user = User::onlyTrashed()->find($data['id']);
            abort_if(! $user, 404, 'Account not found in the recycle bin.');
            try {
                $user->restore();
            } catch (\Illuminate\Database\QueryException $e) {
                // Unique constraint: email or school ID was re-registered meanwhile.
                abort(422, 'This account could not be restored because its email or school ID is already registered.');
            }
            return response()->json(['restored' => 'account', 'id' => $user->id]);
        }

        /** @var Report|null $report */
        $report = Report::withTrashed()->find($data['id']);
        abort_if(! $report, 404, 'Report not found in the recycle bin.');
        if (! $report->trashed()) {
            abort(422, 'This report is not in the recycle bin.');
        }
        $report->restore();
        return response()->json(['restored' => 'report', 'id' => $report->id]);
    }

    /** POST /recycle-bin/purge — the Delete Forever button: removes an account or report (and its photo) for good. */
    public function purge(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate([
            'type' => ['required', 'in:account,report'],
            'id' => ['required'],
        ]);

        if ($data['type'] === 'account') {
            /** @var User|null $user */
            $user = User::onlyTrashed()->find($data['id']);
            // Already gone (e.g. the button was pressed twice): treat as done.
            if (! $user && User::find($data['id'])) {
                return response()->json(null, 204);
            }
            abort_if(! $user, 404, 'Account not found in the recycle bin.');
            $user->forceDelete();
            return response()->json(null, 204);
        }

        /** @var Report|null $report */
        $report = Report::onlyTrashed()->find($data['id']);
        if (! $report && Report::withTrashed()->find($data['id'])) {
            return response()->json(null, 204);
        }
        abort_if(! $report, 404, 'Report not found in the recycle bin.');
        // Remove the stored photo with the report.
        if ($report->getRawOriginal('photo_url')) {
            Storage::disk('public')->delete($report->getRawOriginal('photo_url'));
        }
        $report->forceDelete();
        return response()->json(null, 204);
    }
}
