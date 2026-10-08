<?php

namespace App;

enum BackupStatus: string
{
    case Completed = 'Completed';
    case Pending = 'Pending';
    case Recorded = 'Recorded';
    case NotRecorded = 'Not recorded';
}
