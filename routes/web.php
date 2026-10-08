<?php

use App\Http\Controllers\BackupMonitoringController;
use App\Http\Controllers\InventoryController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('dashboard');
});

Route::get('/backup-monitoring', [BackupMonitoringController::class, 'index'])
    ->name('backup-monitoring.index');

Route::resource('inventory', InventoryController::class)
    ->only(['index', 'store', 'update', 'destroy'])
    ->parameters(['inventory' => 'record']);
