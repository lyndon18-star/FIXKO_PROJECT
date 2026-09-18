<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class RepairLog extends Model
{
    protected $fillable = ['equipment_id','ticket_id','user_id','action','notes','cost','repaired_at'];
    protected $casts = ['repaired_at' => 'date', 'cost' => 'decimal:2'];
    public function user() { return $this->belongsTo(User::class); }
}
