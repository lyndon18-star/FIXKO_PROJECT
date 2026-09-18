<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
class Equipment extends Model
{
    use HasFactory;
    protected $fillable = ['room_id','name','category','asset_tag','condition','quantity','description'];
    protected $casts = ['quantity' => 'integer'];
    public function room() { return $this->belongsTo(Room::class); }
    public function repairLogs() { return $this->hasMany(RepairLog::class); }
    public function tickets() { return $this->hasMany(Ticket::class); }
}
