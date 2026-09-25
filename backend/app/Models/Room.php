<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
class Room extends Model
{
    use HasFactory;
    protected $fillable = ['building','floor','name','code','department'];
    public function reports() { return $this->hasMany(Report::class); }
    public function equipment() { return $this->hasMany(Equipment::class); }
}
