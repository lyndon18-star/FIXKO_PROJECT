<?php
namespace App\Http\Controllers;
use App\Mail\EmailOtpMail;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;

/**
 * AuthController — everything about accounts: verifying a school email with a
 * code, signing up, signing in/out, and resetting a forgotten password.
 */
class AuthController extends Controller
{
    /** School email format — students must exist on the real domain to receive the OTP. */
    private function schoolEmailRule(): array
    {
        return ['required', 'email', 'regex:/^[A-Za-z]+(\\.[A-Za-z]+)*\\.up@phinmaed\\.com$/'];
    }

    /** POST /auth/email-otp — send a one-time code to prove the school email exists. */
    public function sendEmailOtp(Request $request)
    {
        $data = $request->validate(['email' => $this->schoolEmailRule()]);
        $email = strtolower(trim($data['email']));
        $key = 'email-otp:'.sha1($email);

        // One code per email per minute, 6 max per hour (brute-force / spam guard).
        if (RateLimiter::tooManyAttempts('email-otp-send:'.sha1($email), 6)) {
            return response()->json(['message' => 'Too many verification emails requested. Try again in an hour.', 'code' => 'RATE_LIMITED'], 429);
        }
        RateLimiter::hit('email-otp-send:'.sha1($email), 3600);

        $code = (string) random_int(100000, 999999);
        Cache::put($key.':code', Hash::make($code), now()->addMinutes(10));
        Cache::put($key.':attempts', 0, now()->addMinutes(10));
        RateLimiter::clear('email-otp-verify:'.sha1($email));

        Log::info('Email OTP requested.', ['email' => $email]);
        Mail::to($email)->send(new EmailOtpMail($code));

        $payload = ['message' => 'A 6-digit verification code was sent to '.$email.'. It expires in 10 minutes.', 'expires_in' => 600];
        // Local/dev convenience: surface the code so the flow is testable without a mail client.
        if (app()->environment('local', 'development', 'staging')) {
            $payload['debug'] = ['otp_code' => $code];
        }
        return response()->json($payload);
    }

    /** POST /auth/email-otp/verify — exchange the code for a short-lived signup token. */
    public function verifyEmailOtp(Request $request)
    {
        $data = $request->validate([
            'email' => $this->schoolEmailRule(),
            'code' => ['required', 'digits:6'],
        ]);
        $email = strtolower(trim($data['email']));
        $key = 'email-otp:'.sha1($email);

        $stored = Cache::get($key.':code');
        $attempts = (int) Cache::get($key.':attempts', 0);

        if (RateLimiter::tooManyAttempts('email-otp-verify:'.sha1($email), 5)) {
            return response()->json(['message' => 'Too many incorrect attempts. Request a new code.', 'code' => 'RATE_LIMITED'], 429);
        }

        if (! $stored || ! Hash::check($data['code'], $stored)) {
            Cache::put($key.':attempts', $attempts + 1, now()->addMinutes(10));
            RateLimiter::hit('email-otp-verify:'.sha1($email), 600);
            Log::warning('Email OTP verification failed.', ['email' => $email, 'attempts' => $attempts + 1]);
            $message = $attempts + 1 >= 5 ? 'Too many incorrect attempts. Request a new code.' : 'Incorrect verification code.';
            return response()->json(['message' => $message, 'code' => 'OTP_INVALID', 'errors' => ['code' => [$message]]], 422);
        }

        if (RateLimiter::retriesLeft('email-otp-verify:'.sha1($email), 5) <= 2) Log::warning('Email OTP attempts high.', ['email' => $email]);
        $attempts >= 3 && Log::warning('Email OTP suspicious activity.', ['email' => $email]);
        RateLimiter::clear('email-otp-verify:'.sha1($email));
        Cache::forget($key.':code');    // single-use
        Cache::forget($key.':attempts');

        $token = Str::random(60);
        Cache::put('email-verified:'.hash('sha256', $email), ['token_hash' => hash('sha256', $token), 'email' => $email], now()->addMinutes(15));

        return response()->json(['verified' => true, 'email_verification_token' => $token]);
    }

    /** POST /auth/login-verified — finish a password-reset verification by signing the verified user in. */
    public function loginVerified(Request $request)
    {
        $data = $request->validate([
            'email' => $this->schoolEmailRule(),
            'email_verification_token' => ['required', 'string', 'max:120'],
        ]);
        $email = strtolower(trim($data['email']));
        $verificationKey = 'email-verified:'.hash('sha256', $email);
        $verification = Cache::get($verificationKey);
        if (! $verification || ! hash_equals($verification['token_hash'], hash('sha256', $data['email_verification_token']))) {
            return response()->json(['message' => 'Your verification expired. Sign in with your password or verify again.', 'code' => 'VERIFICATION_INVALID'], 422);
        }
        // One login per verification — the token stays valid for creating a new password.
        if ($verification['login_used'] ?? false) {
            Cache::forget($verificationKey);
            return response()->json(['message' => 'This verification was already used to sign in. Please sign in with your password or verify again.', 'code' => 'VERIFICATION_USED'], 422);
        }
        $user = User::where('email', $email)->first();
        if (! $user) return response()->json(['message' => 'No account found for that email.'], 404);
        // Suspended / locked accounts may still continue into the system —
        // EnsureAccountActive keeps them read-only until an admin restores them.
        Cache::put($verificationKey, array_merge($verification, ['login_used' => true]), now()->addMinutes(15));
        Log::info('Verified-email login completed (no password).', ['user_id' => $user->id, 'email' => $email]);
        return response()->json(['user' => $user, 'token' => $user->createToken('fixko-web')->plainTextToken]);
    }

    /** POST /auth/signup — creates a new account after the school email has been verified, then returns a login token. */
    public function signup(Request $request)
    {
        $data = $request->validate([
            'name' => 'nullable|string|max:120',
            'first_name' => 'nullable|string|max:20|regex:/^[\\p{L}][\\p{L} ]*$/u',
            'last_name' => 'nullable|string|max:20|regex:/^[\\p{L}][\\p{L} ]*$/u',
            'middle_name' => 'nullable|string|max:20|regex:/^[\\p{L}][\\p{L} ]*$/u',
            'email' => ['required', 'email', 'unique:users,email', 'regex:/^[A-Za-z]+(\\.[A-Za-z]+)*\\.up@phinmaed\\.com$/'],
            'school_id' => ['required', 'string', 'max:17', 'unique:users,school_id', 'regex:/^\\d{2}-\\d{4}-\\d{6}$|^\\d{2}-\\d{2}-\\d{4}-\\d{6}$/'],
            'password' => ['required', 'confirmed', 'max:25', PasswordRule::min(8)->mixedCase()->numbers()->symbols()],
            'role' => 'nullable|in:user',
            'email_verification_token' => ['required', 'string', 'max:120'],
        ]);

        $email = strtolower(trim($data['email']));
        $verificationKey = 'email-verified:'.hash('sha256', $email);
        $verification = Cache::get($verificationKey);
        // The email must have been proven by OTP within the last 15 minutes,
        // and the token must be the exact single-use one issued at that time.
        if (! $verification || ! hash_equals($verification['token_hash'], hash('sha256', $data['email_verification_token']))) {
            return response()->json([
                'message' => 'Please verify your school email with the code we emailed you before creating an account.',
                'code' => 'EMAIL_NOT_VERIFIED',
                'errors' => ['email' => ['School email not verified via verification code.']],
            ], 422);
        }
        Cache::forget($verificationKey); // single-use — can't recycle a verification for another attempt

        $firstName = trim($data['first_name'] ?? '');
        $middleName = trim($data['middle_name'] ?? '');
        $lastName = trim($data['last_name'] ?? '');
        $name = $data['name'] ?? trim(implode(' ', array_filter([$firstName, $middleName, $lastName])));
        if ($name === '') return response()->json(['message' => 'Please provide your name.', 'code' => 'VALIDATION_ERROR', 'errors' => ['name' => ['The name field is required.']]], 422);
        $user = User::create(array_merge($data, [
            'name' => $name,
            'role' => $data['role'] ?? 'user',
            'email_verified_at' => now(),
        ]));
        Log::info('User signup completed.', ['user_id' => $user->id, 'email' => $user->email]);
        return response()->json(['user' => $user, 'token' => $user->createToken('fixko-web')->plainTextToken], 201);
    }
    /** POST /auth/login — the Sign In button: checks email + password, then returns a login token. */
    public function login(Request $request)
    {
        $data = $request->validate(['email'=>'required|email','password'=>'required|string']);
        $user = User::where('email', $data['email'])->first();
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            Log::warning('User login failed.', ['email' => $data['email']]);
            abort(422, 'Incorrect username or password.');
        }
        if ($user->isBlocked()) {
            // Suspended / locked users may still sign in, but the API middleware
            // keeps their account read-only until an admin restores it.
            Log::info('Blocked account signed in (read-only).', ['user_id' => $user->id, 'status' => $user->account_status]);
        }

        Log::info('User login completed.', ['user_id' => $user->id, 'email' => $user->email]);
        return response()->json(['user' => $user, 'token' => $user->createToken('fixko-web')->plainTextToken]);
    }
    /** POST /auth/logout — the Sign Out button: deletes the current login token so it can no longer be used. */
    public function logout(Request $request) { $request->user()->currentAccessToken()?->delete(); Log::info('User logout completed.', ['user_id' => $request->user()->id]); return response()->json(['message'=>'Logged out.']); }
    /** GET /auth/me — returns the signed-in user's info (used to restore the session when a page loads). */
    public function me(Request $request) { return response()->json($request->user()); }
    /** POST /auth/forgot-password — emails a password-reset link to the user's address. */
    public function forgotPassword(Request $request) { $data = $request->validate(['email'=>'required|email']); $status = Password::sendResetLink($data); return response()->json(['message' => __($status)]); }
    /** POST /auth/reset-password-otp — reset the password for an email proved by an OTP code (flow: forgot → code → new password). */
    public function resetPasswordOtp(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'email_verification_token' => ['required', 'string', 'max:120'],
            'password' => ['required', 'confirmed', PasswordRule::min(8)->mixedCase()->numbers()->symbols()],
        ]);
        $email = strtolower(trim($data['email']));
        $verification = Cache::get('email-verified:'.hash('sha256', $email));
        if (! $verification || ! hash_equals($verification['token_hash'], hash('sha256', $data['email_verification_token']))) {
            return response()->json(['message' => 'Your verification expired. Request a new code.', 'code' => 'VERIFICATION_INVALID'], 422);
        }
        $user = User::where('email', $email)->first();
        if (! $user) return response()->json(['message' => 'No account found for that email.'], 404);
        $user->forceFill(['password' => $data['password']])->save();
        $user->tokens()->delete();
        Cache::forget('email-verified:'.hash('sha256', $email)); // single-use
        Log::info('Password reset via email OTP.', ['email' => $email]);
        return response()->json(['message' => 'Your password has been reset. You can now sign in.']);
    }
    /** POST /auth/reset-password — sets a new password using the token that came from the reset email link. */
    public function resetPassword(Request $request)
    {
        $data = $request->validate(['token'=>'required','email'=>'required|email','password'=>['required','confirmed',PasswordRule::min(8)->mixedCase()->numbers()->symbols()]]);
        $status = Password::reset($data, function (User $user, string $password) { $user->forceFill(['password' => $password])->save(); $user->tokens()->delete(); });
        if ($status !== Password::PASSWORD_RESET) {
            Log::warning('Password reset failed.', ['email' => $data['email'], 'status' => $status]);
        }
        return $status === Password::PASSWORD_RESET ? response()->json(['message' => __($status)]) : response()->json(['message' => __($status)], 422);
    }
}
