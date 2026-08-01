<?php

namespace App\Audit;

enum AuditContextType: string
{
    case Http = 'http';
    case Console = 'console';
    case Queue = 'queue';
    case System = 'system';
}
