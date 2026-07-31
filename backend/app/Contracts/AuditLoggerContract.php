<?php

namespace App\Contracts;

use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Models\AuditLog;

interface AuditLoggerContract
{
    public function record(AuditEvent $event, AuditContext $context): AuditLog;
}
