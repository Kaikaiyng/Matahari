<?php

namespace App\Audit;

enum AuditModule: string
{
    case Legacy = 'legacy';
    case Authentication = 'authentication';
    case Students = 'students';
    case FeeAgreements = 'fee_agreements';
    case Payments = 'payments';
    case Receipts = 'receipts';
    case Users = 'users';
    case Reports = 'reports';
    case Batch = 'batch';
}
