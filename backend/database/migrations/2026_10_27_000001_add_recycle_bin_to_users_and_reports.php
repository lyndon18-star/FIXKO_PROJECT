<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Adds soft-delete columns so deleted accounts and reports stay in the recycle bin. */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->softDeletes();
        });
        Schema::table('reports', function (Blueprint $table) {
            $table->softDeletes();
        });
        // Recycle-bin bookkeeping: how the item ended up in the bin.
        Schema::table('reports', function (Blueprint $table) {
            $table->string('deleted_reason', 30)->nullable()->after('deleted_at');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropColumn(['deleted_reason', 'deleted_at']);
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
