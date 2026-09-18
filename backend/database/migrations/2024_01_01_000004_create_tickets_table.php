<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void { Schema::create('tickets', function (Blueprint $table) { $table->id(); $table->foreignId('reporter_id')->constrained('users')->cascadeOnDelete(); $table->string('reporter_school_id_snapshot'); $table->string('reporter_email_snapshot'); $table->foreignId('room_id')->constrained()->restrictOnDelete(); $table->foreignId('equipment_id')->nullable()->constrained()->nullOnDelete(); $table->string('category')->nullable(); $table->string('item_name')->nullable(); $table->string('condition')->nullable(); $table->unsignedInteger('quantity')->nullable(); $table->text('description'); $table->enum('priority',['low','medium','high','critical'])->default('medium'); $table->enum('status',['pending','under_review','in_progress','resolved'])->default('pending'); $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete(); $table->string('photo_url')->nullable(); $table->timestamp('resolved_at')->nullable(); $table->timestamps(); $table->index(['status','priority']); }); }
    public function down(): void { Schema::dropIfExists('tickets'); }
};
