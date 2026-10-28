<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
/**
 * StatusHistory — the audit trail of a report's status changes (e.g. pending →
 * in progress → resolved), stored in the `ticket_status_histories` table.
 */
class StatusHistory extends Model
{
    // Timestamps are handled manually via changed_at, so turn Laravel's off.
    public $timestamps = false;
    protected $table = 'ticket_status_histories';
    // Fields allowed when logging a status change.
    protected $fillable = ['report_id','old_status','new_status','changed_by','changed_at'];
    // Turn the change timestamp into a date object.
    protected $casts = ['changed_at' => 'datetime'];
    // The user (maintenance worker or admin) who made the change.
    public function user() { return $this->belongsTo(User::class, 'changed_by'); }
}
