<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TicketWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_student_can_submit_a_ticket_and_only_sees_own_tickets(): void
    {
        $student = User::factory()->create();
        $otherStudent = User::factory()->create();
        $room = Room::factory()->create();

        $response = $this->actingAs($student, 'sanctum')->postJson('/api/tickets', [
            'school_id' => 'spoofed-id',
            'email' => 'spoofed@example.com',
            'room_id' => $room->id,
            'category' => 'CITE',
            'item_name' => 'Lighting',
            'condition' => 'Broken',
            'quantity' => 1,
            'description' => 'The hallway light is not working.',
            'priority' => 'high',
        ]);

        $response->assertCreated()
            ->assertJsonPath('reporter_school_id_snapshot', $student->school_id)
            ->assertJsonPath('reporter_email_snapshot', $student->email);

        $this->assertDatabaseHas('tickets', [
            'reporter_id' => $student->id,
            'room_id' => $room->id,
            'status' => 'pending',
        ]);

        $this->actingAs($otherStudent, 'sanctum')
            ->getJson('/api/tickets')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAs($student, 'sanctum')
            ->getJson('/api/tickets')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_admin_can_see_and_update_a_ticket(): void
    {
        $student = User::factory()->create();
        $admin = User::factory()->create(['role' => 'admin']);
        $room = Room::factory()->create();

        $ticket = $this->actingAs($student, 'sanctum')->postJson('/api/tickets', [
            'room_id' => $room->id,
            'description' => 'The projector is broken.',
            'priority' => 'critical',
        ])->json();

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/tickets')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/tickets/{$ticket['id']}/status", ['status' => 'resolved'])
            ->assertOk()
            ->assertJsonPath('status', 'resolved')
            ->assertJsonStructure(['room', 'reporter']);

        $this->assertDatabaseHas('ticket_status_histories', [
            'ticket_id' => $ticket['id'],
            'new_status' => 'resolved',
            'changed_by' => $admin->id,
        ]);
    }

    public function test_faculty_signup_is_rejected(): void
    {
        $this->postJson('/api/auth/signup', [
            'name' => 'Former Faculty',
            'email' => 'faculty@example.com',
            'school_id' => 'FAC-001',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'faculty',
        ])->assertUnprocessable();
    }
}
