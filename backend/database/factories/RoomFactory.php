<?php
namespace Database\Factories;
use App\Models\Room;
use Illuminate\Database\Eloquent\Factories\Factory;
class RoomFactory extends Factory
{
    protected $model = Room::class;

    public function definition(): array
    {
        $building = fake()->randomElement([
            'CMA BUILDING',
            'PTC BUILDING',
            'RIVER SIDE BUILDING',
            'MDA HALL BUILDING',
            'MBA HALL BUILDING',
            'BASIC ED BUILDING',
            'CHS BUILDING',
            'NORTH HALL BUILDING',
            'ITS CSDL BUILDING',
            'GYM',
        ]);
        $maxFloor = match ($building) {
            'RIVER SIDE BUILDING' => 8,
            'MDA HALL BUILDING', 'MBA HALL BUILDING' => 5,
            'ITS CSDL BUILDING' => 2,
            'GYM' => 1,
            default => 4,
        };
        $floor = fake()->numberBetween(1, $maxFloor);
        $number = $building === 'GYM' ? null : $floor * 100 + fake()->numberBetween(1, 99);

        return [
            'building' => $building,
            'floor' => (string) $floor,
            'name' => $building === 'GYM' ? 'Gym' : "Room {$number}",
            'code' => fake()->unique()->bothify('RM-###'),
            'department' => fake()->randomElement(['CITE','CAS','CAHS','CELA','CEA','CMA','CHTM','CCJE','SHS']),
        ];
    }
}
