<?php

namespace App\Audit;

enum AuditAction: string
{
    case LoginSucceeded = 'auth.login_succeeded';
    case LoginFailed = 'auth.login_failed';
    case Logout = 'auth.logout';
    case StudentCreated = 'student.created';
    case StudentUpdated = 'student.updated';
    case StudentStatusChanged = 'student.status_changed';
    case StudentStatusCorrected = 'student.status_corrected';
    case FeeAgreementCreated = 'fee_agreement.created';
    case FeeAgreementSuperseded = 'fee_agreement.superseded';
    case FeeAgreementCorrected = 'fee_agreement.corrected';
    case PaymentRecorded = 'payment.recorded';
    case PaymentVerified = 'payment.verified';
    case PaymentVoided = 'payment.voided';
    case PaymentReversed = 'payment.reversed';
    case PaymentCorrected = 'payment.corrected';
    case ReceiptIssued = 'receipt.issued';
    case ReceiptVoided = 'receipt.voided';
    case ReceiptReplaced = 'receipt.replaced';
    case UserCreated = 'user.created';
    case UserActivated = 'user.activated';
    case UserDeactivated = 'user.deactivated';
    case UserRoleChanged = 'user.role_changed';
    case UserPasswordReset = 'user.password_reset';
    case ReportExported = 'report.exported';
    case ReportPrinted = 'report.printed';
    case BatchChanged = 'batch.changed';
}
