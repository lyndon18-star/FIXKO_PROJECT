<?php

namespace App\Models;

use Illuminate\Auth\Passwords\CanResetPassword;
use Illuminate\Contracts\Auth\CanResetPassword as CanResetPasswordContract;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * User — a signed-up account (student, maintenance worker, or admin) in the
 * `users` table. Handles login tokens, account status (active/suspended/
 * locked), and links to the reports each user filed.
 */
class User extends Authenticatable implements CanResetPasswordContract
{
    use HasApiTokens, HasFactory, Notifiable, CanResetPassword, SoftDeletes;
    // Fields a user is allowed to set when signing up or editing their profile.
    protected $fillable = ['name', 'first_name', 'last_name', 'middle_name', 'email', 'school_id', 'password', 'role', 'department', 'account_status', 'status_until', 'address', 'gender', 'block_section'];
    // Never send the password or remember token back to the frontend.
    protected $hidden = ['password', 'remember_token'];
    // Auto-convert database values: dates to date objects, passwords to hashes.
    protected $casts = ['email_verified_at' => 'datetime', 'password' => 'hashed', 'status_until' => 'datetime'];

    /** How long a suspension lasts before the account auto-restores. */
    public const SUSPENSION_DAYS = 7;

    public const STATUSES = ['active', 'suspended', 'locked'];

    /** True while the account is suspended or locked (suspensions expire on their own). */
    public function isBlocked(): bool
    {
        if (! in_array($this->account_status, ['suspended', 'locked'], true)) {
            return false;
        }
        // A suspension expires automatically: after the deadline it counts as active.
        if ($this->account_status === 'suspended' && $this->status_until && $this->status_until->isPast()) {
            $this->forceFill(['account_status' => 'active', 'status_until' => null])->save();
            return false;
        }
        return true;
    }

    /** Whole days left before a suspension auto-restores (0 on the last day). */
    public function suspensionDaysLeft(): ?int
    {
        if ($this->account_status !== 'suspended' || ! $this->status_until) {
            return null;
        }
        return max(0, (int) ceil(now()->diffInHours($this->status_until) / 24));
    }
    // Uses a custom notification class instead of Laravel's default reset email.
    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new \App\Notifications\ResetPasswordNotification($token));
    }
    // Reports this user has submitted (reports.reporter_id).
    public function reports() { return $this->hasMany(Report::class, 'reporter_id'); }
    // Messages this user has written on report chats (comments.author_id).
    public function comments() { return $this->hasMany(Comment::class, 'author_id'); }
}
