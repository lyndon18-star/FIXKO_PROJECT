<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class Comment extends Model
{
    protected $fillable = ['ticket_id','author_id','message'];
    public function author() { return $this->belongsTo(User::class, 'author_id'); }
    public function ticket() { return $this->belongsTo(Ticket::class); }
}
