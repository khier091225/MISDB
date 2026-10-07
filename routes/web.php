<?php

use App\Http\Controllers\BackupMonitoringController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('dashboard');
});

Route::get('/backup-monitoring', [BackupMonitoringController::class, 'index'])
    ->name('backup-monitoring.index');
