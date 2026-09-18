<?php
namespace App\Http\Controllers;
use App\Models\Equipment;
use Illuminate\Http\Request;
class EquipmentController extends Controller
{
    public function index(Request $request) { return response()->json(Equipment::with('room')->when($request->filled('room_id'), fn ($q) => $q->where('room_id',$request->room_id))->when($request->filled('condition'), fn ($q) => $q->where('condition',$request->condition))->paginate(50)); }
    public function show(Equipment $equipment) { return response()->json($equipment->load('room')); }
    public function store(Request $request) { abort_unless($request->user()->role === 'admin',403); $data=$request->validate(['room_id'=>'required|exists:rooms,id','name'=>'required|string|max:255','category'=>'nullable|string|max:100','asset_tag'=>'nullable|string|max:100','condition'=>'required|in:new,good,fair,poor,broken','quantity'=>'required|integer|min:1','description'=>'nullable|string']); return response()->json(Equipment::create($data),201); }
    public function update(Request $request, Equipment $equipment) { abort_unless(in_array($request->user()->role,['admin','technician'],true),403); $data=$request->validate(['condition'=>'sometimes|in:new,good,fair,poor,broken','quantity'=>'sometimes|integer|min:0','description'=>'nullable|string']); $equipment->update($data); return response()->json($equipment->fresh()); }
    public function repairLog(Request $request, Equipment $equipment) { return response()->json($equipment->repairLogs()->with('user')->latest('repaired_at')->get()); }
    public function storeRepairLog(Request $request, Equipment $equipment) { abort_unless(in_array($request->user()->role,['admin','technician'],true),403); $data=$request->validate(['ticket_id'=>'nullable|exists:tickets,id','action'=>'required|string|max:255','notes'=>'nullable|string','cost'=>'nullable|numeric|min:0','repaired_at'=>'nullable|date']); return response()->json($equipment->repairLogs()->create(array_merge($data,['user_id'=>$request->user()->id])),201); }
}
