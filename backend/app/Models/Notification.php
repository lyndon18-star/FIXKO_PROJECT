<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
/**
 * Notification — one bell-icon message for a user (e.g. "your report was
 * resolved"), stored in the `notifications` table.
 */
class Notification extends Model
{
    // Fields allowed when creating/updating a notification.
    protected $fillable = ['user_id','message','is_read','archived_at','related_report_id'];
    // Turn the read flag into a boolean and the archive date into a date object.
    protected $casts = ['is_read' => 'boolean', 'archived_at' => 'datetime'];
    // The report this notification is about, if any.
    public function report() { return $this->belongsTo(Report::class, 'related_report_id'); }
}
