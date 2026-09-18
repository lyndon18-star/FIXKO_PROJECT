<?php
namespace App\Http\Controllers;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;

class AuthController extends Controller
{
    public function signup(Request $request)
    {
        $data = $request->validate(['name'=>'required|string|max:120','email'=>'required|email|unique:users,email','school_id'=>'required|string|max:64|unique:users,school_id','password'=>'required|string|min:8|confirmed','role'=>'nullable|in:student']);
        $user = User::create(array_merge($data, ['role' => $data['role'] ?? 'student']));
        return response()->json(['user' => $user, 'token' => $user->createToken('fixko-web')->plainTextToken], 201);
    }
    public function login(Request $request)
    {
        $data = $request->validate(['email'=>'required|email','password'=>'required|string']);
        $user = User::where('email', $data['email'])->first();
        abort_unless($user && Hash::check($data['password'], $user->password), 422, 'Invalid credentials.');
        return response()->json(['user' => $user, 'token' => $user->createToken('fixko-web')->plainTextToken]);
    }
    public function logout(Request $request) { $request->user()->currentAccessToken()?->delete(); return response()->json(['message'=>'Logged out.']); }
    public function me(Request $request) { return response()->json($request->user()); }
    public function forgotPassword(Request $request) { $data = $request->validate(['email'=>'required|email']); $status = Password::sendResetLink($data); return response()->json(['message' => __($status)]); }
    public function resetPassword(Request $request)
    {
        $data = $request->validate(['token'=>'required','email'=>'required|email','password'=>'required|min:8|confirmed']);
        $status = Password::reset($data, function (User $user, string $password) { $user->forceFill(['password' => $password])->save(); $user->tokens()->delete(); });
        return $status === Password::PASSWORD_RESET ? response()->json(['message' => __($status)]) : response()->json(['message' => __($status)], 422);
    }
}
