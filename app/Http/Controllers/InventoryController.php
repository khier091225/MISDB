<?php

namespace App\Http\Controllers;

use App\Exceptions\InventoryWorkbookException;
use App\Http\Requests\DeleteInventoryRequest;
use App\Http\Requests\SaveInventoryRequest;
use App\Http\Resources\InventoryWorkbookResource;
use App\Services\InventoryWorkbook;
use Closure;
use Illuminate\Http\JsonResponse;

class InventoryController extends Controller
{
    public function index(InventoryWorkbook $workbook): JsonResponse
    {
        return $this->respond(fn (): array => $workbook->read());
    }

    public function store(SaveInventoryRequest $request, InventoryWorkbook $workbook): JsonResponse
    {
        return $this->respond(fn (): array => $workbook->create($request->validated()), 201);
    }

    public function update(SaveInventoryRequest $request, string $record, InventoryWorkbook $workbook): JsonResponse
    {
        return $this->respond(fn (): array => $workbook->update($record, $request->validated()));
    }

    public function destroy(DeleteInventoryRequest $request, string $record, InventoryWorkbook $workbook): JsonResponse
    {
        return $this->respond(fn (): array => $workbook->delete($record, $request->validated('version')));
    }

    /** @param Closure(): array<string, mixed> $operation */
    private function respond(Closure $operation, int $status = 200): JsonResponse
    {
        try {
            return (new InventoryWorkbookResource($operation()))
                ->response()
                ->setStatusCode($status)
                ->header('Cache-Control', 'no-store');
        } catch (InventoryWorkbookException $exception) {
            if ($exception->status >= 500) {
                report($exception);
            }

            return response()->json(['message' => $exception->getMessage()], $exception->status)
                ->header('Cache-Control', 'no-store');
        }
    }
}
