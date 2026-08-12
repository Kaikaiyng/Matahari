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
    case FeeRecordActivated = 'fee_record.activated';
    case FeeRecordManualChargeCreated = 'fee_record.manual_charge_created';
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
    case AcademicYearCreated = 'academic_year.created';
    case AcademicYearUpdated = 'academic_year.updated';
    case AcademicYearActivated = 'academic_year.activated';
    case SubjectCreated = 'subject.created';
    case SubjectUpdated = 'subject.updated';
    case ClassEnrolmentCreated = 'class_enrolment.created';
    case ClassEnrolmentEnded = 'class_enrolment.ended';
    case TeachingAssignmentCreated = 'teaching_assignment.created';
    case TeachingAssignmentEnded = 'teaching_assignment.ended';
    case GuardianPortalUserLinked = 'guardian.portal_user_linked';
    case StudentPortalUserLinked = 'student.portal_user_linked';
    case GuardianAccessUpdated = 'guardian.access_updated';
    case AttendanceRecorded = 'attendance.recorded';
    case AttendanceCorrected = 'attendance.corrected';
}
