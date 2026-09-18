<?php
namespace App\Http\Resources;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
class TicketResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id'=>$this->id,'status'=>$this->status,'priority'=>$this->priority,'description'=>$this->description,'category'=>$this->category,'item_name'=>$this->item_name,'condition'=>$this->condition,'quantity'=>$this->quantity,'photo_url'=>$this->photo_url ? asset('storage/'.$this->photo_url) : null,'room'=>$this->whenLoaded('room'),'equipment'=>$this->whenLoaded('equipment'),'created_at'=>$this->created_at,'resolved_at'=>$this->resolved_at];
    }
}
