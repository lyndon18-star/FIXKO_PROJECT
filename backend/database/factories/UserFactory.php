<?php
namespace Database\Factories;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
class UserFactory extends Factory
{
    protected $model = User::class;
    public function definition(): array { return ['name'=>fake()->name(),'email'=>fake()->unique()->safeEmail(),'school_id'=>fake()->unique()->numerify('S########'),'password'=>'password','role'=>'student']; }
}
