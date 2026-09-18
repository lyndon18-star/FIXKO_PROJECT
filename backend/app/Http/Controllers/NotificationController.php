<?php
namespace App\Http\Controllers;
use App\Models\Notification;
use Illuminate\Http\Request;
class NotificationController extends Controller
{
    public function index(Request $request) { return response()->json(Notification::where('user_id',$request->user()->id)->with('ticket')->latest()->paginate(30)); }
    public function markRead(Request $request, Notification $notification) { abort_unless($notification->user_id === $request->user()->id,403); $notification->update(['is_read'=>true]); return response()->json($notification); }
}
