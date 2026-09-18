<?php
namespace Database\Seeders;
use App\Models\Room;
use App\Models\User;
use Illuminate\Database\Seeder;
class DatabaseSeeder extends Seeder
{
    public function run(): void { User::factory()->create(['name'=>'Fixko Admin','email'=>'admin@fixko.test','school_id'=>'ADMIN001','role'=>'admin']); Room::factory()->count(12)->create(); }
}
