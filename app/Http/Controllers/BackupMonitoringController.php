<?php

namespace App\Http\Controllers;

use App\Services\BackupWorkbook;
use Illuminate\Http\JsonResponse;
use RuntimeException;

class BackupMonitoringController extends Controller
{
    public function index(BackupWorkbook $workbook): JsonResponse
    {
        try {
            return response()->json($workbook->read())->header('Cache-Control', 'no-store');
        } catch (RuntimeException $exception) {
            report($exception);

            return response()->json([
                'message' => 'The backup Excel file could not be read. Check that it is saved in the forms folder and uses year-named sheets with Computer code, User, and January–December headers.',
            ], 503)->header('Cache-Control', 'no-store');
        }
    }
}
