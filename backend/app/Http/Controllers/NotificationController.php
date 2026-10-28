<?php
namespace App\Http\Controllers;
use App\Models\Notification;
use Illuminate\Http\Request;

/**
 * NotificationController — the notification bell: shows the signed-in user's
 * notifications and lets them mark, archive, or delete them.
 */
class NotificationController extends Controller
{
    /** ?scope=active (default) | archived | all */
    /** GET /notifications — lists this user's notifications, newest first (active ones by default). */
    public function index(Request $request) {
        $query = Notification::where('user_id',$request->user()->id)->with('report')->latest();
        $scope = $request->query('scope','active');
        if ($scope === 'archived') $query->whereNotNull('archived_at');
        elseif ($scope === 'active') $query->whereNull('archived_at');
        return response()->json($query->paginate(30));
    }
    /** PATCH /notifications/{notification}/read — marks one notification as read (removes the unread badge). */
    public function markRead(Request $request, Notification $notification) { abort_unless($notification->user_id === $request->user()->id,403); $notification->update(['is_read'=>true]); return response()->json($notification); }
    /** PATCH /notifications/{notification}/archive — archives (or un-archives) a notification. */
    public function archive(Request $request, Notification $notification) {
        abort_unless($notification->user_id === $request->user()->id,403);
        $notification->update(['archived_at' => $request->boolean('archived', true) ? now() : null]);
        return response()->json($notification);
    }
    /** DELETE /notifications/{notification} — deletes a single notification permanently. */
    public function destroy(Request $request, Notification $notification) { abort_unless($notification->user_id === $request->user()->id,403); $notification->delete(); return response()->json(['deleted'=>true]); }
    /** ?scope=archived (default) | all — bulk delete for the signed-in user. */
    public function destroyAll(Request $request) {
        $query = Notification::where('user_id',$request->user()->id);
        if ($request->query('scope','archived') === 'archived') $query->whereNotNull('archived_at');
        $count = $query->count();
        $query->delete();
        return response()->json(['deleted'=>$count]);
    }
}
