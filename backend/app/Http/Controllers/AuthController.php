<?php
namespace App\Http\Controllers;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rules\Password as PasswordRule;

class AuthController extends Controller
{
    public function signup(Request $request)
    {
        $data = $request->validate([
            'name' => 'nullable|string|max:120',
            'first_name' => 'nullable|string|max:60',
            'last_name' => 'nullable|string|max:60',
            'middle_name' => 'nullable|string|max:60',
            'email' => 'required|email|unique:users,email',
            'school_id' => 'required|string|max:64|unique:users,school_id',
            'password' => ['required', 'confirmed', PasswordRule::min(8)->mixedCase()->numbers()->symbols()],
            'role' => 'nullable|in:user',
        ]);
        $firstName = trim($data['first_name'] ?? '');
        $middleName = trim($data['middle_name'] ?? '');
        $lastName = trim($data['last_name'] ?? '');
        $name = $data['name'] ?? trim(implode(' ', array_filter([$firstName, $middleName, $lastName])));
        if ($name === '') return response()->json(['message' => 'Please provide your name.', 'code' => 'VALIDATION_ERROR', 'errors' => ['name' => ['The name field is required.']]], 422);
        $user = User::create(array_merge($data, [
            'name' => $name,
            'role' => $data['role'] ?? 'user',
        ]));
        Log::info('User signup completed.', ['user_id' => $user->id, 'email' => $user->email]);
        return response()->json(['user' => $user, 'token' => $user->createToken('fixko-web')->plainTextToken], 201);
    }
    public function login(Request $request)
    {
        $data = $request->validate(['email'=>'required|email','password'=>'required|string']);
        $user = User::where('email', $data['email'])->first();
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            Log::warning('User login failed.', ['email' => $data['email']]);
            abort(422, 'Incorrect username or password.');
        }

        Log::info('User login completed.', ['user_id' => $user->id, 'email' => $user->email]);
        return response()->json(['user' => $user, 'token' => $user->createToken('fixko-web')->plainTextToken]);
    }
    public function logout(Request $request) { $request->user()->currentAccessToken()?->delete(); Log::info('User logout completed.', ['user_id' => $request->user()->id]); return response()->json(['message'=>'Logged out.']); }
    public function me(Request $request) { return response()->json($request->user()); }
    public function forgotPassword(Request $request) { $data = $request->validate(['email'=>'required|email']); $status = Password::sendResetLink($data); return response()->json(['message' => __($status)]); }
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
