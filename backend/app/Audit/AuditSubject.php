<?php

namespace App\Audit;

enum AuditSubject: string
{
    case Student = 'student';
    case FeeAgreement = 'fee_agreement';
    case FeeRecordCharge = 'fee_record_charge';
    case Payment = 'payment';
    case Receipt = 'receipt';
    case User = 'user';
    case Report = 'report';
    case Batch = 'batch';
    case AcademicYear = 'academic_year';
    case Subject = 'subject';
    case ClassEnrolment = 'class_enrolment';
    case TeachingAssignment = 'teaching_assignment';
    case Guardian = 'guardian';
    case StudentParentLink = 'student_parent_link';
    case AttendanceSession = 'attendance_session';
    case UserAttendanceAbility = 'user_attendance_ability';
    case CampusAttendanceEvent = 'campus_attendance_event';
    case AttendanceDevice = 'attendance_device';
    case AttendanceSetting = 'attendance_setting';
    case CommunityPost = 'community_post';
    case CommunityComment = 'community_comment';
    case CommunityPolicyAcceptance = 'community_policy_acceptance';
    case CommunityReport = 'community_report';
    case CommunityUserBlock = 'community_user_block';
    case CommunityUserRestriction = 'community_user_restriction';
    case CommunityAppeal = 'community_appeal';
    case StudentCommunityAuthorization = 'student_community_authorization';
    case Assessment = 'assessment';
    case AcademicTerm = 'academic_term';
    case ClassScheduleEntry = 'class_schedule_entry';
    case Quiz = 'quiz';
    case QuizAssignment = 'quiz_assignment';
    case QuizAttempt = 'quiz_attempt';
    case Tenant = 'tenant';
    case TenantDomain = 'tenant_domain';
    case School = 'school';
    case SchoolSupportSetting = 'school_support_setting';
}
