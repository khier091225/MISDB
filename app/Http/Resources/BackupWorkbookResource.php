<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BackupWorkbookResource extends JsonResource
{
    public static $wrap = null;

    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'source' => $this->resource['source'],
            'years' => $this->resource['years'],
            'default_period' => $this->resource['default_period'],
            'records' => $this->resource['records'],
        ];
    }
}
