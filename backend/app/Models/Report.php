<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

/**
 * Report — a maintenance ticket for a broken item, stored in the `reports`
 * table. Soft-deleted reports stay here (and in the recycle bin) until purged.
 */
class Report extends Model
{
    use HasFactory, SoftDeletes;
    // Fields allowed on create/update (photo_url stores the file path).
    protected $fillable = ['reporter_id','reporter_school_id_snapshot','reporter_email_snapshot','room_id','category','item_name','condition','quantity','description','priority','status','handled_by','photo_url','resolved_at','is_flagged','flag_reason','flag_note','flagged_at','deleted_reason'];
    // Turn the resolved timestamp into a date object.
    protected $casts = ['resolved_at' => 'datetime'];
    // Turns the stored photo path into a full public URL for the frontend.
    public function getPhotoUrlAttribute(?string $value): ?string
    {
        return $value ? Storage::disk('public')->url($value) : null;
    }
    // The student who submitted the report (reports.reporter_id).
    public function reporter() { return $this->belongsTo(User::class, 'reporter_id'); }
    // The maintenance worker assigned to fix it (reports.handled_by).
    public function handler() { return $this->belongsTo(User::class, 'handled_by'); }
    // The room/location the report is about.
    public function room() { return $this->belongsTo(Room::class); }
    // Chat messages on this report.
    public function comments() { return $this->hasMany(Comment::class); }
    // Audit trail of every status change (pending → in progress → resolved…).
    public function statusHistory() { return $this->hasMany(StatusHistory::class); }
    // The reporter's star rating after the report is resolved (one per report).
    public function feedback() { return $this->hasOne(Feedback::class); }
}
