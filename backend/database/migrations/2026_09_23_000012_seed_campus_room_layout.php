<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $buildings = [
            'CMA BUILDING' => 4,
            'BASIC ED BUILDING' => 4,
            'PTC BUILDING' => 4,
            'MDA HALL BUILDING' => 5,
            'MBA HALL BUILDING' => 5,
            'CHS BUILDING' => 4,
            'NORTH HALL BUILDING' => 4,
            'RIVER SIDE BUILDING' => 8,
        ];

        foreach ($buildings as $building => $lastFloor) {
            for ($floor = 1; $floor <= $lastFloor; $floor++) {
                $roomStart = $floor * 100 + 1;
                $roomEnd = $floor * 100 + 99;

                if ($building === 'RIVER SIDE BUILDING' && $floor === 8) {
                    $roomNames = ['Room 801', 'Room 802', 'Room 803', 'Open Field'];
                } else {
                    $roomNames = array_map(
                        static fn (int $number): string => "Room {$number}",
                        range($roomStart, $roomEnd)
                    );
                }

                $this->insertRooms($building, (string) $floor, $roomNames);
            }
        }

        $this->insertRooms('ITS CSDL BUILDING', '1', ['Room 101']);
        $this->insertRooms('ITS CSDL BUILDING', '2', ['Room 201', 'Room 202']);
        $this->insertRooms('GYM', '1', ['Gym']);
    }

    public function down(): void
    {
        DB::table('rooms')
            ->whereIn('building', [
                'CMA BUILDING',
                'BASIC ED BUILDING',
                'PTC BUILDING',
                'MDA HALL BUILDING',
                'MBA HALL BUILDING',
                'CHS BUILDING',
                'NORTH HALL BUILDING',
                'RIVER SIDE BUILDING',
                'ITS CSDL BUILDING',
                'GYM',
            ])
            ->where(function ($query) {
                $query->whereIn('name', ['Gym', 'Open Field'])
                    ->orWhereRaw("name REGEXP '^Room [1-9][0-9][0-9]$'");
            })
            ->delete();
    }

    private function insertRooms(string $building, string $floor, array $roomNames): void
    {
        $now = now();

        foreach ($roomNames as $name) {
            DB::table('rooms')->insertOrIgnore([
                'building' => $building,
                'floor' => $floor,
                'name' => $name,
                'code' => "{$building}-{$name}",
                'department' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
};
