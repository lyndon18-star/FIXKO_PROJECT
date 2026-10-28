<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
/**
 * Comment — one chat message on a report, stored in the `comments` table.
 */
class Comment extends Model
{
    // Fields allowed when creating a comment.
    protected $fillable = ['report_id','author_id','message'];
    // The user who wrote the message (comments.author_id).
    public function author() { return $this->belongsTo(User::class, 'author_id'); }
    // The report this message belongs to.
    public function report() { return $this->belongsTo(Report::class); }
}
