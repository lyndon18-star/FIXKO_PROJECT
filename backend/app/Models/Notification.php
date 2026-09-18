<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class Notification extends Model
{
    protected $fillable = ['user_id','message','is_read','related_ticket_id'];
    protected $casts = ['is_read' => 'boolean'];
    public function ticket() { return $this->belongsTo(Ticket::class, 'related_ticket_id'); }
}
