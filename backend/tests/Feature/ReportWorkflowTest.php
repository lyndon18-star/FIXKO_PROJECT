<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ReportWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_submit_a_report_and_only_sees_own_reports(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        $room = Room::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/reports', [
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
            ->assertJsonPath('reporter_school_id_snapshot', $user->school_id)
            ->assertJsonPath('reporter_email_snapshot', $user->email);

        $this->assertDatabaseHas('reports', [
            'reporter_id' => $user->id,
            'room_id' => $room->id,
            'status' => 'pending',
        ]);

        $this->actingAs($otherUser, 'sanctum')
            ->getJson('/api/reports')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/reports')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_admin_can_see_and_update_a_report(): void
    {
        $user = User::factory()->create();
        $admin = User::factory()->create(['role' => 'admin']);
        $room = Room::factory()->create();

        $report = $this->actingAs($user, 'sanctum')->postJson('/api/reports', [
            'room_id' => $room->id,
            'description' => 'The projector is broken.',
            'priority' => 'critical',
        ])->json();

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/reports')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/reports/{$report['id']}/status", ['status' => 'resolved'])
            ->assertOk()
            ->assertJsonPath('status', 'resolved')
            ->assertJsonStructure(['room', 'reporter']);

        $this->assertDatabaseHas('ticket_status_histories', [
            'report_id' => $report['id'],
            'new_status' => 'resolved',
            'changed_by' => $admin->id,
        ]);
    }

    public function test_unsupported_role_signup_is_rejected(): void
    {
        $this->postJson('/api/auth/signup', [
            'name' => 'Unsupported Role',
            'email' => 'unsupported@example.com',
            'school_id' => 'USR-001',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'manager',
        ])->assertUnprocessable();
    }

    public function test_login_returns_a_consistent_error_for_invalid_credentials(): void
    {
        User::factory()->create(['email' => 'user@example.com', 'password' => 'password123']);

        $this->postJson('/api/auth/login', [
            'email' => 'user@example.com',
            'password' => 'wrong-password',
        ])->assertStatus(422)
            ->assertJsonStructure(['message', 'code', 'request_id'])
        ->assertJsonPath('code', 'UNPROCESSABLE_ENTITY')
        ->assertJsonPath('message', 'Incorrect username or password.');
    }

    public function test_validation_errors_include_field_errors_and_request_id(): void
    {
        $this->postJson('/api/auth/login', [])
            ->assertStatus(422)
            ->assertJsonStructure([
                'message',
                'code',
                'request_id',
                'errors' => ['email', 'password'],
            ])
            ->assertJsonPath('code', 'VALIDATION_ERROR');
    }

    public function test_missing_api_resource_returns_a_consistent_not_found_error(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/reports/999999')
            ->assertNotFound()
            ->assertJsonStructure(['message', 'code', 'request_id'])
            ->assertJsonPath('code', 'NOT_FOUND');
    }

    public function test_user_can_submit_a_report_with_a_photo_path(): void
    {
        Storage::fake('public');
        $user = User::factory()->create();
        $room = Room::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->post('/api/reports', [
            'room_id' => $room->id,
            'description' => 'The classroom light is broken.',
            'priority' => 'high',
            'photo' => UploadedFile::fake()->create('broken-light.jpg', 100, 'image/jpeg'),
        ], ['Accept' => 'application/json']);

        $response->assertCreated();
        $photoPath = $response->json('photo_url');
        $storedPhotoPath = preg_replace('#^/?(?:.*?/)?storage/#', '', parse_url($photoPath, PHP_URL_PATH) ?: $photoPath);
        $this->assertNotEmpty($photoPath);
        $this->assertDatabaseHas('reports', [
            'reporter_id' => $user->id,
            'photo_url' => $storedPhotoPath,
        ]);
        Storage::disk('public')->assertExists($storedPhotoPath);
    }

    public function test_reporter_can_add_a_comment_to_their_report(): void
    {
        $user = User::factory()->create();
        $room = Room::factory()->create();
        $report = $user->reports()->create([
            'reporter_school_id_snapshot' => $user->school_id,
            'reporter_email_snapshot' => $user->email,
            'room_id' => $room->id,
            'description' => 'The classroom door is difficult to open.',
            'priority' => 'medium',
            'status' => 'pending',
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/reports/{$report->id}/comments", [
                'message' => 'It is getting worse during the afternoon.',
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'It is getting worse during the afternoon.')
            ->assertJsonPath('author.id', $user->id);

        $this->assertDatabaseHas('comments', [
            'report_id' => $report->id,
            'author_id' => $user->id,
            'message' => 'It is getting worse during the afternoon.',
        ]);
    }
}
