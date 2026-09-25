<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('comments', function (Blueprint $table) { $table->id(); $table->foreignId('report_id')->constrained()->cascadeOnDelete(); $table->foreignId('author_id')->constrained('users')->cascadeOnDelete(); $table->text('message'); $table->timestamps(); });
        Schema::create('ticket_status_histories', function (Blueprint $table) { $table->id(); $table->foreignId('report_id')->constrained()->cascadeOnDelete(); $table->string('old_status')->nullable(); $table->string('new_status'); $table->foreignId('changed_by')->constrained('users')->restrictOnDelete(); $table->timestamp('changed_at')->useCurrent(); });
        Schema::create('feedback', function (Blueprint $table) { $table->id(); $table->foreignId('report_id')->unique()->constrained()->cascadeOnDelete(); $table->foreignId('user_id')->constrained()->cascadeOnDelete(); $table->unsignedTinyInteger('rating'); $table->text('comment')->nullable(); $table->timestamps(); });
        Schema::create('repair_history', function (Blueprint $table) { $table->id(); $table->foreignId('equipment_id')->constrained()->cascadeOnDelete(); $table->foreignId('report_id')->nullable()->constrained()->nullOnDelete(); $table->foreignId('user_id')->constrained()->restrictOnDelete(); $table->string('action'); $table->text('notes')->nullable(); $table->decimal('cost',10,2)->nullable(); $table->date('repaired_at')->nullable(); $table->timestamps(); });
        Schema::create('notifications', function (Blueprint $table) { $table->id(); $table->foreignId('user_id')->constrained()->cascadeOnDelete(); $table->text('message'); $table->boolean('is_read')->default(false); $table->foreignId('related_report_id')->nullable()->constrained('reports')->nullOnDelete(); $table->timestamps(); });
    }
    public function down(): void { foreach (['notifications','repair_history','feedback','ticket_status_histories','comments'] as $table) Schema::dropIfExists($table); }
};
