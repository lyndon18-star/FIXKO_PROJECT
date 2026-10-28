<?php
namespace Database\Factories;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
class UserFactory extends Factory
{
    protected $model = User::class;
    public function definition(): array { return ['name'=>fake()->name(),'email'=>fake()->unique()->firstName().'.'.fake()->unique()->lastName().'@phinmaed.com','school_id'=>fake()->unique()->numerify('03-##-####-######'),'password'=>'password','role'=>'user']; }
}
