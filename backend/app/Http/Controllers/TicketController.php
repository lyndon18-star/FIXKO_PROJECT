<?php
namespace App\Http\Controllers;

use App\Models\Notification;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;

class TicketController extends Controller
{
    public function index(Request $request)
    {
        $query = Ticket::with(['room','equipment','reporter','comments.author','feedback'])->latest();
        if ($request->user()->role === 'student') $query->where('reporter_id', $request->user()->id);
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
        $ticket = DB::transaction(function () use ($request, $data, $user) {
            $path = $request->hasFile('photo') ? $request->file('photo')->store('ticket-photos', 'public') : null;
            $ticket = $user->tickets()->create(array_merge($data, [
                'reporter_school_id_snapshot' => $user->school_id,
                'reporter_email_snapshot' => $user->email,
                'photo_url' => $path,
                'status' => 'pending',
            ]));
            $ticket->statusHistory()->create([
                'old_status' => null,
                'new_status' => 'pending',
                'changed_by' => $user->id,
            ]);

            User::whereIn('role', ['admin', 'technician'])->get()->each(function (User $staff) use ($ticket) {
                Notification::create([
                    'user_id' => $staff->id,
                    'message' => "New ticket {$ticket->id} was submitted for review.",
                    'related_ticket_id' => $ticket->id,
                ]);
            });

            return $ticket;
        });

        return response()->json($ticket->load(['room','equipment','reporter','comments.author','feedback']), 201);
    }

    public function show(Request $request, Ticket $ticket)
    {
        $this->authorizeTicket($request, $ticket);
        return response()->json($ticket->load(['room','equipment','reporter','comments.author','statusHistory.user','feedback']));
    }

    public function update(Request $request, Ticket $ticket)
    {
        abort_unless(in_array($request->user()->role, ['admin','technician'], true), 403);
        $data = $request->validate(['priority' => ['sometimes','in:low,medium,high,critical'], 'assigned_to' => ['nullable','exists:users,id'], 'description' => ['sometimes','string','max:5000']]);
        $ticket->update($data);
        return response()->json($ticket->fresh()->load(['room','equipment']));
    }

    public function destroy(Request $request, Ticket $ticket)
    {
        abort_unless($ticket->reporter_id === $request->user()->id || $request->user()->role === 'admin', 403);
        abort_if($ticket->status === 'resolved', 422, 'Resolved tickets cannot be deleted.');
        $ticket->delete();
        return response()->noContent();
    }

    public function updateStatus(Request $request, Ticket $ticket)
    {
        abort_unless(in_array($request->user()->role, ['admin','technician'], true), 403);
        $data = $request->validate(['status' => ['required','in:pending,under_review,in_progress,resolved']]);
        $old = $ticket->status;
        $ticket->update(['status' => $data['status'], 'resolved_at' => $data['status'] === 'resolved' ? now() : null]);
        if ($old !== $ticket->status) $ticket->statusHistory()->create(['old_status' => $old, 'new_status' => $ticket->status, 'changed_by' => $request->user()->id]);
        return response()->json($ticket->fresh()->load(['room','equipment','reporter','comments.author','feedback']));
    }

    public function comment(Request $request, Ticket $ticket)
    {
        $this->authorizeTicket($request, $ticket);
        $data = $request->validate(['message' => ['required','string','max:2000']]);
        return response()->json($ticket->comments()->create(['author_id' => $request->user()->id, 'message' => $data['message']])->load('author'), 201);
    }

    public function feedback(Request $request, Ticket $ticket)
    {
        abort_unless($ticket->reporter_id === $request->user()->id, 403);
        abort_unless($ticket->status === 'resolved', 422, 'Feedback is available after resolution.');
        $data = $request->validate(['rating' => ['required','integer','between:1,5'], 'comment' => ['nullable','string','max:1000']]);
        return response()->json($ticket->feedback()->updateOrCreate(['ticket_id' => $ticket->id], array_merge($data, ['user_id' => $request->user()->id])), 201);
    }

    private function authorizeTicket(Request $request, Ticket $ticket): void
    {
        abort_unless($ticket->reporter_id === $request->user()->id || in_array($request->user()->role, ['admin','technician'], true), 403);
    }
}
