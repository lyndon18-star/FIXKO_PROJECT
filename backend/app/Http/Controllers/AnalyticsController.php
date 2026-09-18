<?php
namespace App\Http\Controllers;
use App\Models\Ticket;
use Illuminate\Support\Facades\DB;
class AnalyticsController extends Controller
{
    public function summary() {
        abort_unless(in_array(request()->user()->role,['admin','technician'],true),403);
        $resolved = Ticket::whereNotNull('resolved_at')->get(['created_at','resolved_at']);
        $average = $resolved->isEmpty() ? null : round($resolved->avg(fn ($ticket) => $ticket->created_at->diffInMinutes($ticket->resolved_at) / 60), 2);
        return response()->json(['counts'=>Ticket::select('status',DB::raw('count(*) as total'))->groupBy('status')->pluck('total','status'),'by_priority'=>Ticket::select('priority',DB::raw('count(*) as total'))->groupBy('priority')->pluck('total','priority'),'by_building'=>Ticket::join('rooms','rooms.id','=','tickets.room_id')->select('rooms.building',DB::raw('count(*) as total'))->groupBy('rooms.building')->pluck('total','building'),'most_reported'=>Ticket::select('item_name',DB::raw('count(*) as total'))->whereNotNull('item_name')->groupBy('item_name')->orderByDesc('total')->limit(10)->get(),'average_resolution_hours'=>$average]);
    }
}
