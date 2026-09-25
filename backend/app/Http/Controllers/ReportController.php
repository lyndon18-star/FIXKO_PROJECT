<?php
namespace App\Http\Controllers;

use App\Models\Notification;
use App\Models\Report;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function index(Request $request)
    {
        $query = Report::with(['room','equipment','reporter','comments.author','feedback'])->latest();
        if ($request->user()->role === 'user') $query->where('reporter_id', $request->user()->id);
        return response()->json($query
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->when($request->filled('priority'), fn ($q) => $q->where('priority', $request->priority))
            ->when($request->filled('room_id'), fn ($q) => $q->where('room_id', $request->room_id))
            ->when($request->filled('department'), fn ($q) => $q->whereHas('room', fn ($r) => $r->where('department', $request->department)))
            ->paginate((int) min($request->integer('per_page', 100), 100)));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'room_id' => ['required','exists:rooms,id'], 'equipment_id' => ['nullable','exists:equipment,id'],
            'category' => ['nullable','string','max:100'], 'item_name' => ['nullable','string','max:255'],
            'condition' => ['nullable','string','max:100'], 'quantity' => ['nullable','integer','min:1','max:10000'],
            'description' => ['required','string','max:5000'], 'priority' => ['required','in:low,medium,high,critical'],
            'photo' => ['nullable','image','max:5120'],
        ]);
        $user = $request->user();
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
                    'message' => "New report {$report->id} was submitted for review.",
                    'related_report_id' => $report->id,
                ]);
            });

            return $report;
        });

        return response()->json($report->load(['room','equipment','reporter','comments.author','feedback']), 201);
    }

    public function show(Request $request, Report $report)
    {
        $this->authorizeReport($request, $report);
        return response()->json($report->load(['room','equipment','reporter','comments.author','statusHistory.user','feedback']));
    }

    public function update(Request $request, Report $report)
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate(['priority' => ['sometimes','in:low,medium,high,critical'], 'handled_by' => ['nullable','exists:users,id'], 'description' => ['sometimes','string','max:5000']]);
        $report->update($data);
        return response()->json($report->fresh()->load(['room','equipment']));
    }

    public function destroy(Request $request, Report $report)
    {
        abort_unless($report->reporter_id === $request->user()->id || $request->user()->role === 'admin', 403);
        abort_if($report->status === 'resolved', 422, 'Resolved reports cannot be deleted.');
        $report->delete();
        return response()->noContent();
    }

    public function updateStatus(Request $request, Report $report)
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate(['status' => ['required','in:pending,under_review,in_progress,resolved']]);
        $old = $report->status;
        $report->update(['status' => $data['status'], 'resolved_at' => $data['status'] === 'resolved' ? now() : null]);
        if ($old !== $report->status) $report->statusHistory()->create(['old_status' => $old, 'new_status' => $report->status, 'changed_by' => $request->user()->id]);
        return response()->json($report->fresh()->load(['room','equipment','reporter','comments.author','feedback']));
    }

    public function comment(Request $request, Report $report)
    {
        $this->authorizeReport($request, $report);
        $data = $request->validate(['message' => ['required','string','max:2000']]);
        return response()->json($report->comments()->create(['author_id' => $request->user()->id, 'message' => $data['message']])->load('author'), 201);
    }

    public function feedback(Request $request, Report $report)
    {
        abort_unless($report->reporter_id === $request->user()->id, 403);
        abort_unless($report->status === 'resolved', 422, 'Feedback is available after resolution.');
        $data = $request->validate(['rating' => ['required','integer','between:1,5'], 'comment' => ['nullable','string','max:1000']]);
        return response()->json($report->feedback()->updateOrCreate(['report_id' => $report->id], array_merge($data, ['user_id' => $request->user()->id])), 201);
    }

    private function authorizeReport(Request $request, Report $report): void
    {
        abort_unless($report->reporter_id === $request->user()->id || $request->user()->role === 'admin', 403);
    }
}
