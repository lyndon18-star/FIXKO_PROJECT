<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class Notification extends Model
{
    protected $fillable = ['user_id','message','is_read','related_report_id'];
    protected $casts = ['is_read' => 'boolean'];
    public function report() { return $this->belongsTo(Report::class, 'related_report_id'); }
}
