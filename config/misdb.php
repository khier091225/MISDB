<?php

return [
    'backup_workbook' => env('MISDB_BACKUP_WORKBOOK', base_path('forms/F-MIS-06 Monthly Back-up Monitoring Sheet(1).xlsx')),
    'inventory_workbook' => env('MISDB_INVENTORY_WORKBOOK', base_path('forms/COMPUTER INVENTORY FORM.xlsx')),
    'inventory_backups' => env('MISDB_INVENTORY_BACKUPS', storage_path('app/private/inventory-backups')),
    'timezone' => env('MISDB_TIMEZONE', 'Asia/Manila'),
];
