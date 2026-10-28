<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedInteger('warnings_count')->default(0)->after('status_until');
        });

        Schema::table('reports', function (Blueprint $table) {
            $table->boolean('is_flagged')->default(false)->after('status');
            $table->string('flag_reason', 100)->nullable()->after('is_flagged');
            $table->text('flag_note')->nullable()->after('flag_reason');
            $table->timestamp('flagged_at')->nullable()->after('flag_note');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('warnings_count');
        });

        Schema::table('reports', function (Blueprint $table) {
            $table->dropColumn(['is_flagged', 'flag_reason', 'flag_note', 'flagged_at']);
        });
    }
};
