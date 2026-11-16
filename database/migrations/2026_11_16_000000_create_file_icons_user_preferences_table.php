<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Not recorded yet, so a table left here is from an earlier run that failed halfway.
        Schema::dropIfExists('file_icons_user_preferences');

        Schema::create('file_icons_user_preferences', function (Blueprint $table) {
            $table->id();
            // users.id is an unsigned INT (increments), so no foreignId() here.
            $table->unsignedInteger('user_id')->unique();
            $table->string('theme', 32);
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('file_icons_user_preferences');
    }
};
