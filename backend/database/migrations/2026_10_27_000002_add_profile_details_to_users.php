<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Extra contact details students must complete before they can submit reports. */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('address')->nullable()->after('department');
            $table->enum('gender', ['male', 'female', 'other'])->nullable()->after('address');
            $table->string('block_section', 120)->nullable()->after('gender');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['block_section', 'gender', 'address']);
        });
    }
};
