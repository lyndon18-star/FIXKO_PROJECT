<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * UserController — admin tools for managing accounts (view, suspend/lock/
 * restore, warn, delete) plus each user editing their own profile details.
 */
class UserController extends Controller
{
    /** GET /users — admin-only list of all accounts, with their report counts; can be filtered by role. */
    public function index(Request $request)
    {
        abort_unless($request->user()->role === 'admin', 403);

        return response()->json(User::query()
            ->when($request->filled('role'), fn ($q) => $q->where('role', $request->query('role')))
            ->withCount('reports')
            ->orderBy('created_at')
            ->get(['id', 'name', 'email', 'school_id', 'role', 'department', 'account_status', 'status_until', 'warnings_count', 'created_at']));
    }

    /** PATCH /users/{user}/status — admin suspends, locks, or restores an account; blocked accounts are logged out right away. */
    public function updateStatus(Request $request, User $user)
    {
        abort_unless($request->user()->role === 'admin', 403);
        abort_unless(in_array($user->role, ['user', 'maintenance'], true), 422, 'Only user and maintenance accounts can be managed.');
        $data = $request->validate(['status' => ['required', 'in:active,suspended,locked']]);
        if ($data['status'] === 'suspended') {
            $user->update(['account_status' => 'suspended', 'status_until' => now()->addDays(User::SUSPENSION_DAYS)]);
        } else {
            // Restoring (or locking, which has no expiration) clears the deadline.
            $user->update(['account_status' => $data['status'], 'status_until' => null]);
        }
        // Kick suspended/locked accounts out immediately.
        if (in_array($data['status'], ['suspended', 'locked'], true)) {
            $user->tokens()->delete();
            Log::info('Account blocked by admin.', ['admin_id' => $request->user()->id, 'user_id' => $user->id, 'status' => $data['status']]);
        } else {
            Log::info('Account restored by admin.', ['admin_id' => $request->user()->id, 'user_id' => $user->id]);
        }
        return response()->noContent();
    }

    /**
     * Admin warns a maintenance worker for not doing their job.
     * Escalation: 1st = warning, 2nd = 1-week suspension, 3rd = account lock.
     */
    public function warn(Request $request, User $user)
    {
        abort_unless($request->user()->role === 'admin', 403);
        abort_unless($user->role === 'maintenance', 422, 'Only maintenance accounts can be warned.');
        abort_unless($user->account_status === 'active', 422, 'This account is already suspended or locked.');
        $data = $request->validate([
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $user->increment('warnings_count');
        $warnings = $user->fresh()->warnings_count;
        $note = isset($data['note']) && $data['note'] !== '' ? ' Reason: '.$data['note'] : '';

        if ($warnings >= 3) {
            $user->update(['account_status' => 'locked', 'status_until' => null]);
            $user->tokens()->delete();
            Notification::create([
                'user_id' => $user->id,
                'message' => "Final warning (3 of 3): your account has been locked automatically due to unaddressed assigned reports.{$note} Contact your school administrator to restore it.",
            ]);
            Log::warning('Maintenance account auto-locked (warning 3).', ['admin_id' => $request->user()->id, 'user_id' => $user->id]);
            $result = 'locked';
        } elseif ($warnings === 2) {
            $user->update(['account_status' => 'suspended', 'status_until' => now()->addDays(User::SUSPENSION_DAYS)]);
            $user->tokens()->delete();
            Notification::create([
                'user_id' => $user->id,
                'message' => "Warning 2 of 3 (final warning next): your account is suspended for 1 week due to unaddressed assigned reports.{$note} You cannot submit or handle reports until restored.",
            ]);
            Log::warning('Maintenance account auto-suspended (warning 2).', ['admin_id' => $request->user()->id, 'user_id' => $user->id]);
            $result = 'suspended';
        } else {
            Notification::create([
                'user_id' => $user->id,
                'message' => "Warning 1 of 3: you have unaddressed assigned reports that need your attention.{$note} Further neglect leads to suspension, then a permanent lock.",
            ]);
            $result = 'active';
        }

        return response()->json([
            'warnings_count' => $user->fresh()->warnings_count,
            'account_status' => $result,
        ]);
    }

    /** DELETE /users/{user} — admin deletes a user or maintenance account (soft-deleted, so it can be restored). */
    public function destroy(Request $request, User $user)
    {
        abort_unless($request->user()->role === 'admin', 403);
        abort_unless(in_array($user->role, ['user', 'maintenance'], true), 422, 'Only user and maintenance accounts can be deleted.');
        $user->delete();
        return response()->noContent();
    }

    /** Change password (every role, optional) and/or contact details (students only). */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $changingPassword = $request->filled('password') || $request->filled('current_password');

        $rules = [];
        if ($user->role === 'user') {
            // Students must complete these before they are allowed to report.
            $rules += [
                'address' => ['required', 'string', 'max:255'],
                'gender' => ['required', 'in:male,female,other'],
                'block_section' => ['required', 'string', 'max:120'],
            ];
        }
        if ($changingPassword) {
            $rules += [
                'current_password' => ['required', 'string'],
                'password' => ['required', 'confirmed', \Illuminate\Validation\Rules\Password::min(8)],
            ];
        }

        $data = $request->validate($rules);

        if ($changingPassword) {
            abort_unless(
                \Illuminate\Support\Facades\Hash::check($data['current_password'], $user->password),
                422,
                'The current password is incorrect.'
            );
            $user->password = $data['password'];
        }

        if ($user->role === 'user') {
            $user->fill([
                'address' => $data['address'],
                'gender' => $data['gender'],
                'block_section' => $data['block_section'],
            ]);
        }

        $user->save();

        $tokenless = $user->makeHidden(['password', 'remember_token', 'tokens']);
        return response()->json($tokenless);
    }
}
