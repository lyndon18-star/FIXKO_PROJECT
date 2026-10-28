<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class AddMaintenanceRoleAndPersonnel extends Migration {
    public function up(): void {
        if (DB::connection()->getDriverName() === 'sqlite') {
            // Tests run on SQLite: rebuild the tables without the enum CHECK constraints (app-level validation remains).
            DB::statement('PRAGMA foreign_keys = OFF;');
            Schema::create('users_rebuild_tmp', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('email')->unique();
                $table->string('school_id')->unique();
                $table->string('password');
                $table->string('role')->default('user');
                $table->string('department')->nullable();
                $table->timestamp('email_verified_at')->nullable();
                $table->string('remember_token')->nullable();
                $table->timestamps();
                $table->string('first_name')->nullable();
                $table->string('last_name')->nullable();
                $table->string('middle_name')->nullable();
            });
            DB::statement('INSERT INTO users_rebuild_tmp SELECT id,name,email,school_id,password,role,department,email_verified_at,remember_token,created_at,updated_at,first_name,last_name,middle_name FROM users');
            Schema::drop('users');
            Schema::rename('users_rebuild_tmp', 'users');

            Schema::create('reports_rebuild_tmp', function (Blueprint $table) {
                $table->id();
                $table->foreignId('reporter_id')->constrained('users')->cascadeOnDelete();
                $table->string('reporter_school_id_snapshot');
                $table->string('reporter_email_snapshot');
                $table->foreignId('room_id')->constrained()->restrictOnDelete();
                $table->foreignId('equipment_id')->nullable()->constrained()->nullOnDelete();
                $table->string('category')->nullable();
                $table->string('item_name')->nullable();
                $table->string('condition')->nullable();
                $table->unsignedInteger('quantity')->nullable();
                $table->text('description');
                $table->string('priority')->default('medium');
                $table->string('status')->default('pending');
                $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('photo_url')->nullable();
                $table->timestamp('resolved_at')->nullable();
                $table->timestamps();
                $table->index(['status','priority']);
            });
            DB::statement('INSERT INTO reports_rebuild_tmp SELECT id,reporter_id,reporter_school_id_snapshot,reporter_email_snapshot,room_id,equipment_id,category,item_name,condition,quantity,description,priority,status,handled_by,photo_url,resolved_at,created_at,updated_at FROM reports');
            Schema::drop('reports');
            Schema::rename('reports_rebuild_tmp', 'reports');
            DB::statement('PRAGMA foreign_keys = ON;');
        } else {
            // New role: maintenance personnel (assigned by admin only)
            DB::statement("ALTER TABLE `users` MODIFY `role` ENUM('user','admin','maintenance') NOT NULL DEFAULT 'user'");
            // New report status the maintenance personnel can set
            DB::statement("ALTER TABLE `reports` MODIFY `status` ENUM('pending','under_review','in_progress','under_maintenance','resolved') NOT NULL DEFAULT 'pending'");
        }

        // Seed exactly 4 maintenance personnel accounts
        $personnel = [
            ['name' => 'Miguel Santos',   'email' => 'maintenance1@phinmaed.com', 'school_id' => 'MT-2026-001', 'first_name' => 'Miguel',  'last_name' => 'Santos'],
            ['name' => 'Carla Reyes',     'email' => 'maintenance2@phinmaed.com', 'school_id' => 'MT-2026-002', 'first_name' => 'Carla',   'last_name' => 'Reyes'],
            ['name' => 'John Dela Cruz',  'email' => 'maintenance3@phinmaed.com', 'school_id' => 'MT-2026-003', 'first_name' => 'John',    'last_name' => 'Dela Cruz'],
            ['name' => 'Ana Lim',         'email' => 'maintenance4@phinmaed.com', 'school_id' => 'MT-2026-004', 'first_name' => 'Ana',     'last_name' => 'Lim'],
        ];

        foreach ($personnel as $person) {
            DB::table('users')->updateOrInsert(
                ['email' => $person['email']],
                array_merge($person, [
                    'role' => 'maintenance',
                    'department' => 'Maintenance',
                    'password' => Hash::make('Maintenance@123'),
                    'email_verified_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ])
            );
        }
    }

    public function down(): void {
        DB::table('users')->where('role', 'maintenance')->delete();
        if (DB::connection()->getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE `reports` MODIFY `status` ENUM('pending','under_review','in_progress','resolved') NOT NULL DEFAULT 'pending'");
            DB::statement("ALTER TABLE `users` MODIFY `role` ENUM('user','admin') NOT NULL DEFAULT 'user'");
        }
    }
}
