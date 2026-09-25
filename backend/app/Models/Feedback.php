<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class Feedback extends Model
{
    protected $fillable = ['report_id','user_id','rating','comment'];
    public function report() { return $this->belongsTo(Report::class); }
    public function user() { return $this->belongsTo(User::class); }
}
