<?php

namespace App\Http\Controllers;

use App\Models\Ticket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TicketController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tickets = Ticket::query()
            ->when($request->string('status')->isNotEmpty(), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->string('priority')->isNotEmpty(), fn ($query) => $query->where('priority', $request->string('priority')))
            ->latest()
            ->paginate(20);

        return response()->json($tickets);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'school_id' => ['required', 'string', 'max:64'],
            'email' => ['required', 'email'],
            'room_id' => ['required', 'exists:rooms,id'],
            'description' => ['required', 'string', 'max:5000'],
            'priority' => ['required', 'in:low,medium,high,critical'],
            'photo' => ['nullable', 'image', 'max:5120'],
        ]);

        $ticket = $request->user()->tickets()->create([
            'reporter_school_id_snapshot' => $validated['school_id'],
            'reporter_email_snapshot' => $validated['email'],
            'room_id' => $validated['room_id'],
            'description' => $validated['description'],
            'priority' => $validated['priority'],
            'status' => 'pending',
            'photo_url' => isset($validated['photo']) ? $validated['photo']->store('ticket-photos', 'public') : null,
        ]);

        return response()->json($ticket, 201);
    }

    public function show(Ticket $ticket): JsonResponse
    {
        return response()->json($ticket->load(['comments', 'statusHistory', 'room']));
    }

    public function updateStatus(Request $request, Ticket $ticket): JsonResponse
    {
        $data = $request->validate(['status' => ['required', 'in:pending,under_review,in_progress,resolved']]);
        $oldStatus = $ticket->status;
        $ticket->update($data);
        $ticket->statusHistory()->create([
            'old_status' => $oldStatus,
            'new_status' => $ticket->status,
            'changed_by' => $request->user()->id,
        ]);

        return response()->json($ticket->fresh());
    }

    public function comment(Request $request, Ticket $ticket): JsonResponse
    {
        $data = $request->validate(['message' => ['required', 'string', 'max:2000']]);
        return response()->json($ticket->comments()->create([
            'author_id' => $request->user()->id,
            'message' => $data['message'],
        ]), 201);
    }

    public function feedback(Request $request, Ticket $ticket): JsonResponse
    {
        abort_unless($ticket->status === 'resolved', 422, 'Feedback is available after resolution.');
        $data = $request->validate(['rating' => ['required', 'integer', 'between:1,5'], 'comment' => ['nullable', 'string', 'max:1000']]);
        return response()->json($ticket->feedback()->create($data), 201);
    }
}
