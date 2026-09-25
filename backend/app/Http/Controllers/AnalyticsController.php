<?php
namespace App\Http\Controllers;
use App\Models\Report;
use Illuminate\Support\Facades\DB;
class AnalyticsController extends Controller
{
    public function summary() {
        abort_unless(request()->user()->role === 'admin',403);
        $resolved = Report::whereNotNull('resolved_at')->get(['created_at','resolved_at']);
        $average = $resolved->isEmpty() ? null : round($resolved->avg(fn ($report) => $report->created_at->diffInMinutes($report->resolved_at) / 60), 2);
        return response()->json(['counts'=>Report::select('status',DB::raw('count(*) as total'))->groupBy('status')->pluck('total','status'),'by_priority'=>Report::select('priority',DB::raw('count(*) as total'))->groupBy('priority')->pluck('total','priority'),'by_building'=>Report::join('rooms','rooms.id','=','reports.room_id')->select('rooms.building',DB::raw('count(*) as total'))->groupBy('rooms.building')->pluck('total','building'),'most_reported'=>Report::select('item_name',DB::raw('count(*) as total'))->whereNotNull('item_name')->groupBy('item_name')->orderByDesc('total')->limit(10)->get(),'average_resolution_hours'=>$average]);
    }
}
