<?php

namespace App\Audit;

enum AuditSubject: string
{
    case Student = 'student';
    case FeeAgreement = 'fee_agreement';
    case Payment = 'payment';
    case Receipt = 'receipt';
    case User = 'user';
    case Report = 'report';
    case Batch = 'batch';
}
