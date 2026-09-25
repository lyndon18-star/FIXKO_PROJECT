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
        ];

        foreach ($buildings as $building => $lastFloor) {
            for ($floor = 1; $floor <= $lastFloor; $floor++) {
                DB::table('rooms')->insertOrIgnore([
                    'building' => $building,
                    'floor' => (string) $floor,
                    'name' => "Room {$floor}00",
                    'code' => "{$building}-Room {$floor}00",
                    'department' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
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
            ])
            ->where('name', 'REGEXP', '^Room [1-5]00$')
            ->delete();
    }
};
