<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class StatusHistory extends Model
{
    public $timestamps = false;
    protected $table = 'ticket_status_histories';
    protected $fillable = ['ticket_id','old_status','new_status','changed_by','changed_at'];
    protected $casts = ['changed_at' => 'datetime'];
    public function user() { return $this->belongsTo(User::class, 'changed_by'); }
}
