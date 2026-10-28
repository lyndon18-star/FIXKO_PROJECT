<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
/**
 * Feedback — the reporter's 1–5 star rating and optional comment on a resolved
 * report, stored in the `feedbacks` table.
 */
class Feedback extends Model
{
    // Fields allowed when leaving feedback.
    protected $fillable = ['report_id','user_id','rating','comment'];
    // The report being rated.
    public function report() { return $this->belongsTo(Report::class); }
    // The student who left the rating.
    public function user() { return $this->belongsTo(User::class); }
}
