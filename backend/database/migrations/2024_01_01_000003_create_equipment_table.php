<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void { Schema::create('equipment', function (Blueprint $table) { $table->id(); $table->foreignId('room_id')->constrained()->cascadeOnDelete(); $table->string('name'); $table->string('category')->nullable(); $table->string('asset_tag')->nullable()->unique(); $table->enum('condition',['new','good','fair','poor','broken'])->default('good'); $table->unsignedInteger('quantity')->default(1); $table->text('description')->nullable(); $table->timestamps(); }); }
    public function down(): void { Schema::dropIfExists('equipment'); }
};
