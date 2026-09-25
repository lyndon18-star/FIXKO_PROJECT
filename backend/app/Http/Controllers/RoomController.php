<?php
namespace App\Http\Controllers;
use App\Models\Room;
use Illuminate\Http\Request;
class RoomController extends Controller
{
    public function index(Request $request) { return response()->json(Room::withCount(['reports as open_reports_count' => fn ($q) => $q->where('status','!=','resolved')])->when($request->filled('building'), fn ($q) => $q->where('building',$request->building))->orderBy('building')->orderBy('floor')->get()); }
    public function show(Room $room) { return response()->json($room->load('equipment')->loadCount('reports')); }
    public function qr(Room $room) { return response()->json(['room_id'=>$room->id,'url'=>rtrim(config('app.url'),'/').'/report?room='.$room->id]); }
}
