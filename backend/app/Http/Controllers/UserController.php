<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->role === 'admin', 403);

        return response()->json(User::query()
            ->withCount('reports')
            ->orderBy('created_at')
            ->get(['id', 'name', 'email', 'school_id', 'role', 'department', 'created_at']));
    }
}
