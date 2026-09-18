<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Ticket extends Model
{
    use HasFactory;
    protected $fillable = ['reporter_id','reporter_school_id_snapshot','reporter_email_snapshot','room_id','equipment_id','category','item_name','condition','quantity','description','priority','status','assigned_to','photo_url','resolved_at'];
    protected $casts = ['resolved_at' => 'datetime'];
    public function reporter() { return $this->belongsTo(User::class, 'reporter_id'); }
    public function room() { return $this->belongsTo(Room::class); }
    public function equipment() { return $this->belongsTo(Equipment::class); }
    public function comments() { return $this->hasMany(Comment::class); }
    public function statusHistory() { return $this->hasMany(StatusHistory::class); }
    public function feedback() { return $this->hasOne(Feedback::class); }
}
