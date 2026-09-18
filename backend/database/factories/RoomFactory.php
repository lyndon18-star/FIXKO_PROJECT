<?php
namespace Database\Factories;
use App\Models\Room;
use Illuminate\Database\Eloquent\Factories\Factory;
class RoomFactory extends Factory
{
    protected $model = Room::class;
    public function definition(): array { return ['building'=>fake()->randomElement(['CMA BUILDING','PTC BUILDING','RIVER SIDE BUILDING','MDA HALL BUILDING','MBA HALL BUILDING','BASIC ED BUILDING','CHS BUILDING','NORTH HALL BUILDING','ITS CSDL BUILDING','GYM']),'floor'=>(string) fake()->numberBetween(1,5),'name'=>'Room '.fake()->numberBetween(100,999),'code'=>fake()->unique()->bothify('RM-###'),'department'=>fake()->randomElement(['CITE','CAS','CAHS','CELA','CEA','CMA','CHTM','CCJE','SHS'])]; }
}
