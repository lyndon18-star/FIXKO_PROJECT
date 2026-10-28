<?php
namespace App\Http\Controllers;

use App\Models\Notification;
use App\Models\Report;
use App\Models\User;
use App\Services\AiImageDetector;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Request;

/**
 * ReportController — the main maintenance-ticket system: students submit
 * broken-item reports with a photo, maintenance personnel work on them, and
 * admins assign, flag, and review. Also handles comments and ratings.
 */
class ReportController extends Controller
{
    /** GET /reports — lists reports with related info; students see their own, maintenance sees theirs, admins see all. */
    public function index(Request $request)
    {
        $query = Report::with(['room','reporter','handler','comments.author','feedback'])->latest();
        if ($request->user()->role === 'user') $query->where('reporter_id', $request->user()->id);
        elseif ($request->user()->role === 'maintenance') $query->where('handled_by', $request->user()->id);
        return response()->json($query
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->when($request->filled('priority'), fn ($q) => $q->where('priority', $request->priority))
            ->when($request->filled('room_id'), fn ($q) => $q->where('room_id', $request->room_id))
            ->when($request->filled('department'), fn ($q) => $q->whereHas('room', fn ($r) => $r->where('department', $request->department)))
            ->paginate((int) min($request->integer('per_page', 100), 100)));
    }

    /** POST /reports — the Submit Report button: saves the report + photo, logs its history, and notifies the admins. */
    public function store(Request $request)
    {
        // Hard guard (in addition to EnsureAccountActive): suspended/locked
        // accounts can never submit reports, by any route or token.
        if ($request->user()?->isBlocked()) {
            return response()->json([
                'message' => $request->user()->account_status === 'suspended'
                    ? 'Your account is suspended — you cannot submit a report until it is restored.'
                    : 'Your account is locked — you cannot submit a report until an administrator unlocks it.',
                'code' => 'ACCOUNT_BLOCKED',
            ], 403);
        }

        // Students must complete their contact details before reporting.
        abort_if(
            $request->user()->role === 'user' && (
                ! $request->user()->address
                || ! $request->user()->gender
                || ! $request->user()->block_section
            ),
            422,
            'Complete your profile details first (address, gender, and block/section) in Profile settings before submitting a report.'
        );

        $data = $request->validate([
            'room_id' => ['required','exists:rooms,id'],
            'category' => ['required','string','max:100'], 'item_name' => ['required','string','max:255'],
            'condition' => ['required','string','max:100'], 'quantity' => ['nullable','integer','min:1','max:10000'],
            'description' => ['required','string','max:5000'], 'priority' => ['required','in:low,medium,high,critical'],
            'photo' => ['required','image','max:5120'],
        ]);
        $user = $request->user();

        // AI-generated photo attempt: refuse the upload, warn, and auto-lock on
        // the second attempt (handled in rejectAiPhoto).
        if ($request->hasFile('photo')) {
            $detector = new AiImageDetector();
            if ($detector->detect($request->file('photo'))) {
                $this->rejectAiPhoto($user);
            }
        }

        $report = DB::transaction(function () use ($request, $data, $user) {
            $path = $request->hasFile('photo') ? $request->file('photo')->store('report-photos', 'public') : null;
            $report = $user->reports()->create(array_merge($data, [
                'reporter_school_id_snapshot' => $user->school_id,
                'reporter_email_snapshot' => $user->email,
                'photo_url' => $path,
                'status' => 'pending',
            ]));
            $report->statusHistory()->create([
                'old_status' => null,
                'new_status' => 'pending',
                'changed_by' => $user->id,
            ]);

            User::where('role', 'admin')->get()->each(function (User $admin) use ($report) {
                Notification::create([
                    'user_id' => $admin->id,
                    'message' => "New report {$this->ticketCode($report)} was submitted for review.",
                    'related_report_id' => $report->id,
                ]);
            });

            return $report;
        });

        return response()->json($report->load(['room','reporter','handler','comments.author','feedback']), 201);
    }

    /** GET /reports/{report} — shows one report's full details, allowed only to its reporter, the assigned handler, or an admin. */
    public function show(Request $request, Report $report)
    {
        $this->authorizeReport($request, $report);
        return response()->json($report->load(['room','reporter','handler','comments.author','statusHistory.user','feedback']));
    }

    /** PUT /reports/{report} — admin edits a report (priority, description) or assigns it to a maintenance worker, who then gets a notification. */
    public function update(Request $request, Report $report)
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate(['priority' => ['sometimes','in:low,medium,high,critical'], 'handled_by' => ['nullable','exists:users,id'], 'description' => ['sometimes','string','max:5000']]);

        // Resolved reports are locked: no reassignment or other changes.
        abort_if(array_key_exists('handled_by', $data) && $report->status === 'resolved' && $data['handled_by'] !== (string) $report->handled_by, 422, 'This report is already resolved and can no longer be reassigned.');

        // Only the admin assigns, and reports are assigned to maintenance personnel only.
        $assignerWasChanged = false;
        if (array_key_exists('handled_by', $data)) {
            if ($data['handled_by']) {
                $assignee = User::find($data['handled_by']);
                abort_unless($assignee && $assignee->role === 'maintenance', 422, 'Reports can only be assigned to maintenance personnel.');
                if ($report->handled_by !== (int) $data['handled_by']) $assignerWasChanged = true;
            } elseif ($report->handled_by) {
                $assignerWasChanged = true;
            }
        }

        $report->update($data);

        if ($assignerWasChanged && $data['handled_by']) {
            Notification::create([
                'user_id' => (int) $data['handled_by'],
                'message' => "You were assigned to report {$this->ticketCode($report)} by the admin.",
                'related_report_id' => $report->id,
            ]);
        }

        return response()->json($report->fresh()->load(['room','handler']));
    }

    /** DELETE /reports/{report} — the Delete/Withdraw button: soft-deletes the report so an admin can restore it later. */
    public function destroy(Request $request, Report $report)
    {
        abort_unless($report->reporter_id === $request->user()->id || $request->user()->role === 'admin', 403);
        abort_if($report->status === 'resolved', 422, 'Resolved reports cannot be deleted.');
        $report->deleted_reason = $request->user()->role === 'admin' ? 'removed' : 'withdrawn';
        $report->save();
        $report->delete();
        return response()->noContent();
    }

    /** PATCH /reports/{report}/status — maintenance updates the report's status and the reporter + admins get notified. */
    public function updateStatus(Request $request, Report $report)
    {
        $user = $request->user();
        // Only maintenance personnel change the report status — the admin only assigns.
        // They may only update reports assigned to them, and may only put them
        // in progress / under maintenance / mark them resolved.
        $maintenanceStatuses = ['in_progress','under_maintenance','resolved'];
        abort_unless($user->role === 'maintenance', 403, 'Only maintenance personnel can change the report status.');
        abort_unless($report->handled_by === $user->id, 403, 'This report is not assigned to you.');
        $data = $request->validate(['status' => ['required','in:pending,under_review,in_progress,under_maintenance,resolved']]);
        abort_unless(in_array($data['status'], $maintenanceStatuses, true), 422, 'Maintenance personnel can only set in progress, under maintenance, or resolved.');
        abort_if($report->status === 'resolved' && $data['status'] !== 'resolved', 422, 'This report is already resolved and can no longer be changed.');
        $old = $report->status;
        $report->update(['status' => $data['status'], 'resolved_at' => $data['status'] === 'resolved' ? now() : null]);
        if ($old !== $report->status) {
            $report->statusHistory()->create(['old_status' => $old, 'new_status' => $report->status, 'changed_by' => $user->id]);
            $statusLabels = ['pending' => 'pending', 'under_review' => 'under review', 'in_progress' => 'in progress', 'under_maintenance' => 'under maintenance', 'resolved' => 'resolved'];
            if ($report->reporter_id !== $user->id) {
                $message = $report->status === 'resolved'
                    ? "Report {$this->ticketCode($report)} was resolved."
                    : "Report {$this->ticketCode($report)} is now " . ($statusLabels[$report->status] ?? $report->status) . ".";
                Notification::create([
                    'user_id' => $report->reporter_id,
                    'message' => $message,
                    'related_report_id' => $report->id,
                ]);
            }
            // Notify the admins when a maintenance personnel updates the status.
            User::where('role', 'admin')->get()->each(function (User $admin) use ($report, $user, $statusLabels) {
                Notification::create([
                    'user_id' => $admin->id,
                    'message' => "{$user->name} set report {$this->ticketCode($report)} to " . ($statusLabels[$report->status] ?? $report->status) . ".",
                    'related_report_id' => $report->id,
                ]);
            });
        }
        return response()->json($report->fresh()->load(['room','reporter','handler','comments.author','feedback']));
    }

    /** POST /reports/{report}/comments — the Send Message button in a report's chat; everyone involved gets notified. */
    public function comment(Request $request, Report $report)
    {
        $this->authorizeReport($request, $report);
        $user = $request->user();

        // A flagged report locks the reporter out of the conversation until the
        // admin reviews it; only admins and handlers may still comment.
        if ((int) $report->reporter_id === (int) $user->id) {
            abort_if($report->is_flagged, 422, 'This report was flagged by the admin, so commenting is disabled. You can still rate the work once it is resolved.');
        }

        // A resolved report is closed: the reporter and the solver cannot add
        // new messages, but the reporter can still rate the work.
        if ($report->status === 'resolved' && $user->role !== 'admin') {
            abort_if((int) $report->reporter_id === (int) $user->id, 422, 'The issue has been solved, so commenting is closed. You can still leave a rating or feedback.');
            abort_if((int) $report->handled_by === (int) $user->id, 422, 'This report is resolved and closed for comments.');
        }

        $data = $request->validate(['message' => ['required','string','max:2000']]);
        $comment = $report->comments()->create(['author_id' => $request->user()->id, 'message' => $data['message']])->load('author');

        // Fan the comment out to everyone involved on the report — except the author:
        // the reporter, the assigned maintenance personnel, and the admins.
        $author = $request->user();
        $content = "New message from {$author->name} on report {$this->ticketCode($report)}.";
        $recipients = collect([$report->reporter_id, $report->handled_by])
            ->merge(User::where('role', 'admin')->pluck('id'))
            ->filter(fn ($id) => $id && (int) $id !== $author->id)
            ->unique();
        $recipients->each(fn ($id) => Notification::create([
                'user_id' => (int) $id,
                'message' => $content,
                'related_report_id' => $report->id,
            ]));

        return response()->json($comment, 201);
    }

    /** POST /reports/{report}/feedback — the reporter rates the finished work (1–5 stars + optional comment); admins are notified. */
    public function feedback(Request $request, Report $report)
    {
        abort_unless($report->reporter_id === $request->user()->id, 403);
        abort_unless($report->status === 'resolved', 422, 'Feedback is available after resolution.');
        $data = $request->validate(['rating' => ['required','integer','between:1,5'], 'comment' => ['nullable','string','max:1000']]);
        $feedback = $report->feedback()->updateOrCreate(['report_id' => $report->id], array_merge($data, ['user_id' => $request->user()->id]));

        // Let every admin know the reporter rated this report.
        $stars = str_repeat('★', (int) $data['rating']).str_repeat('☆', 5 - (int) $data['rating']);
        $content = $request->user()->name.' rated report '.$this->ticketCode($report).' '.$stars.' '.
            $data['rating'].'/5.'.($data['comment'] ? ' Feedback: '.mb_substr($data['comment'], 0, 120) : '');
        User::where('role', 'admin')->pluck('id')->each(fn ($id) => Notification::create([
            'user_id' => (int) $id,
            'message' => $content,
            'related_report_id' => $report->id,
        ]));

        return response()->json($feedback, 201);
    }

    /** POST /reports/{report}/flag — admin flags a bad report: warns the reporter (auto-suspend/lock after repeats) and deletes the report. */
    public function flag(Request $request, Report $report)
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate([
            'reason' => ['required', 'in:inappropriate,misinformation,ai_generated'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);
        $reasonLabels = [
            'inappropriate' => 'inappropriate content',
            'misinformation' => 'misinformation',
            'ai_generated' => 'an AI-generated photo',
        ];
        $message = "Warning: your report {$this->ticketCode($report)} was flagged by the admin for {$reasonLabels[$data['reason']]}. Repeated violations can lead to suspension of your account.";

        // The reporter's account is formally warned: 1st = warning, 2nd = suspension, 3rd = lock.
        $reporter = User::find($report->reporter_id);
        $statusNotice = null;
        if ($reporter && $reporter->account_status === 'active') {
            $reporter->increment('warnings_count');
            $warnings = $reporter->fresh()->warnings_count;

            if ($warnings >= 3) {
                $reporter->update(['account_status' => 'locked', 'status_until' => null]);
                $reporter->tokens()->delete();
                $statusNotice = 'Final warning (3 of 3): your account has been locked automatically due to repeated flagged reports.';
                Log::warning('Reporter account auto-locked after 3 flagged reports.', ['admin_id' => $request->user()->id, 'user_id' => $reporter->id]);
            } elseif ($warnings === 2) {
                $reporter->update(['account_status' => 'suspended', 'status_until' => now()->addDays(User::SUSPENSION_DAYS)]);
                $reporter->tokens()->delete();
                $statusNotice = 'Warning 2 of 3 (final warning next): your account is suspended for 1 week due to repeated flagged reports. You cannot submit or handle reports until restored.';
                Log::warning('Reporter account auto-suspended after 2 flagged reports.', ['admin_id' => $request->user()->id, 'user_id' => $reporter->id]);
            }
        }
        if ($statusNotice) {
            Notification::create([
                'user_id' => $report->reporter_id,
                'message' => $statusNotice,
            ]);
        }

        Notification::create([
            'user_id' => $report->reporter_id,
            'message' => $message,
            'related_report_id' => $report->id,
        ]);
        Log::info('Report flagged by admin and deleted.', ['report_id' => $report->id, 'admin_id' => $request->user()->id, 'reason' => $data['reason']]);
        // The report itself is removed after the reporter has been warned.
        $report->delete();
        return response()->json(['message' => 'Report flagged and deleted.']);
    }

    /** POST /reports/{report}/unflag — admin clears a flag so the reporter can comment again. */
    public function unflag(Request $request, Report $report)
    {
        abort_unless($request->user()->role === 'admin', 403);
        $report->update(['is_flagged' => false, 'flag_reason' => null, 'flag_note' => null, 'flagged_at' => null]);
        return response()->json($report->fresh());
    }

    /** Refuse an AI-generated photo: warn on the 1st attempt, auto-lock the account on the 2nd. */
    private function rejectAiPhoto(User $user): never
    {
        $user->increment('warnings_count');
        $warnings = $user->fresh()->warnings_count;

        if ($warnings >= 2) {
            $user->forceFill(['account_status' => 'locked', 'status_until' => null])->save();
            $user->tokens()->delete();
            Notification::create([
                'user_id' => $user->id,
                'message' => 'Your account was locked automatically. A report photo you submitted was detected as AI-generated for the second time. Contact your school administrator to restore your account.',
            ]);
            Log::warning('Account auto-locked after repeated AI image attempts.', ['user_id' => $user->id]);
        } else {
            Notification::create([
                'user_id' => $user->id,
                'message' => 'Warning 1 of 2: the photo on your report was detected as AI-generated. Real photos are required. Another attempt will lock your account automatically.',
            ]);
        }

        abort(403, 'AI-generated image detected. Real photos are required — '
            . ($warnings >= 2
                ? 'this was your second attempt, so your account has been locked automatically.'
                : 'this is warning ' . $warnings . ' of 2. A second attempt will lock your account.'));
    }

    /** Makes sure only the report's reporter, its assigned handler, or an admin can view/act on it. */
    private function authorizeReport(Request $request, Report $report): void
    {
        abort_unless($report->reporter_id === $request->user()->id
            || $request->user()->role === 'admin'
            || ($request->user()->role === 'maintenance' && $report->handled_by === $request->user()->id), 403);
    }

    /** Human-friendly ticket code matching the frontend, e.g. FX-0005. */
    private function ticketCode(Report $report): string
    {
        return 'FX-' . str_pad((string) $report->id, 4, '0', STR_PAD_LEFT);
    }
}
