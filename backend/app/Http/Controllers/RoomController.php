<?php
namespace App\Http\Controllers;
use App\Models\Room;
use Illuminate\Http\Request;
/**
 * RoomController — reads the list of rooms/campus locations and builds the
 * QR-code links students can scan to start a report for that room.
 */
class RoomController extends Controller
{
    /** GET /rooms — lists all rooms (optionally filtered by building) with a count of their open reports. */
    public function index(Request $request) { return response()->json(Room::withCount(['reports as open_reports_count' => fn ($q) => $q->where('status','!=','resolved')])->when($request->filled('building'), fn ($q) => $q->where('building',$request->building))->orderBy('building')->orderBy('floor')->get()); }
    /** GET /rooms/{room} — shows one room's details plus how many reports it has. */
    public function show(Room $room) { return response()->json($room->loadCount('reports')); }
    /** GET /rooms/{room}/qr — returns the QR-code URL for this room; scanning it opens a pre-filled report page. */
    public function qr(Room $room) { return response()->json(['room_id'=>$room->id,'url'=>rtrim(config('app.url'),'/').'/report?room='.$room->id]); }
}
