<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
/**
 * Room — a campus location (building + floor + name/code) that reports can be
 * filed for, stored in the `rooms` table.
 */
class Room extends Model
{
    use HasFactory;
    // Fields allowed when creating or updating a room.
    protected $fillable = ['building','floor','name','code','department'];
    // All reports filed for this room.
    public function reports() { return $this->hasMany(Report::class); }
}
