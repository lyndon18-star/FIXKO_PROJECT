<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        $buildings = [
            'CMA BUILDING',
            'PTC BUILDING',
            'BASIC ED BUILDING',
            'CHS BUILDING',
            'NORTH HALL BUILDING',
            'GYM',
        ];

        foreach ($buildings as $building) {
            if (! DB::table('rooms')->where('building', $building)->exists()) {
                DB::table('rooms')->insert([
                    'building' => $building,
                    'floor' => '1',
                    'name' => 'Main Room',
                    'code' => 'ROOM-' . strtoupper(substr(md5($building), 0, 8)),
                    'department' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        DB::table('rooms')->whereIn('building', [
            'CMA BUILDING',
            'PTC BUILDING',
            'BASIC ED BUILDING',
            'CHS BUILDING',
            'NORTH HALL BUILDING',
            'GYM',
        ])->where('name', 'Main Room')->delete();
    }
};
