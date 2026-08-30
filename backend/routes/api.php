<?php

use App\Http\Controllers\Api\ApplicationLogController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CalendarEventController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\FeeAgreementController;
use App\Http\Controllers\Api\FeeItemController;
use App\Http\Controllers\Api\FeeRecordController;
use App\Http\Controllers\Api\InvoiceGenerationController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\PaymentReminderController;
use App\Http\Controllers\Api\ReceiptController;
use App\Http\Controllers\Api\SchoolClassController;
use App\Http\Controllers\Api\StudentController;
use App\Http\Controllers\Api\StudentFeeAgreementController;
use App\Http\Controllers\Api\StudentStatusController;
use App\Http\Controllers\Api\TenantContextController;
use App\Http\Controllers\Api\V1\AcademicTermController;
use App\Http\Controllers\Api\V1\AcademicYearController;
use App\Http\Controllers\Api\V1\AdminAttendanceController;
use App\Http\Controllers\Api\V1\AssessmentController;
use App\Http\Controllers\Api\V1\AttendanceAbilityController;
use App\Http\Controllers\Api\V1\CampusAttendanceController;
use App\Http\Controllers\Api\V1\ClassEnrolmentController;
use App\Http\Controllers\Api\V1\ClassScheduleController;
use App\Http\Controllers\Api\V1\CommunityController;
use App\Http\Controllers\Api\V1\CommunityModerationController;
use App\Http\Controllers\Api\V1\CommunitySafetyController;
use App\Http\Controllers\Api\V1\EmployeeAccessController;
use App\Http\Controllers\Api\V1\FoundationAccountController;
use App\Http\Controllers\Api\V1\ParentPortalController;
use App\Http\Controllers\Api\V1\PlatformCommunityModerationController;
use App\Http\Controllers\Api\V1\PlatformTenantController;
use App\Http\Controllers\Api\V1\PortalLinkController;
use App\Http\Controllers\Api\V1\PortalNotificationController;
use App\Http\Controllers\Api\V1\PublicCommunityPolicyController;
use App\Http\Controllers\Api\V1\QuizController;
use App\Http\Controllers\Api\V1\SchoolSettingsController;
use App\Http\Controllers\Api\V1\StaffController;
use App\Http\Controllers\Api\V1\StudentPortalController;
use App\Http\Controllers\Api\V1\SubjectController;
use App\Http\Controllers\Api\V1\TeacherAttendanceController;
use App\Http\Controllers\Api\V1\TeacherScopeController;
use App\Http\Controllers\Api\V1\TeachingAssignmentController;
use App\Http\Controllers\Api\V1\TenantSettingsController;
use App\Http\Controllers\DeploymentInfoController;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;

Route::get('/deployment-info', DeploymentInfoController::class)->name('deployment-info');
Route::get('/tenant-context', TenantContextController::class)->name('tenant-context');
Route::get('/v1/public/community-policies/{slug}', [PublicCommunityPolicyController::class, 'show']);

$sessionMiddleware = [
    EncryptCookies::class,
    AddQueuedCookiesToResponse::class,
    StartSession::class,
    PreventRequestForgery::class,
];

Route::middleware($sessionMiddleware)->group(function (): void {
    Route::get('/csrf-cookie', fn () => response()->noContent());
    Route::post('/login', [AuthController::class, 'login']);

    Route::middleware(['auth', 'active', 'tenant.member'])->group(function (): void {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});

Route::middleware([...$sessionMiddleware, 'auth', 'active', 'tenant.member', 'tenant.surface:admin'])->group(function (): void {
    Route::prefix('v1/platform')->middleware('platform.owner')->group(function (): void {
        Route::get('/tenants', [PlatformTenantController::class, 'index']);
        Route::post('/tenants', [PlatformTenantController::class, 'store']);
        Route::patch('/tenants/{tenant}/status', [PlatformTenantController::class, 'updateStatus']);
        Route::patch('/tenants/{tenant}/branding', [PlatformTenantController::class, 'updateBranding']);
        Route::post('/tenants/{tenant}/domains', [PlatformTenantController::class, 'storeDomain']);
        Route::post('/tenants/{tenant}/domains/{tenantDomain}/activate', [PlatformTenantController::class, 'activateDomain']);
        Route::put('/tenants/{tenant}/features/{featureKey}', [PlatformTenantController::class, 'updateFeature']);
        Route::post('/tenants/{tenant}/schools', [PlatformTenantController::class, 'storeSchool']);
        Route::put('/tenants/{tenant}/memberships/{user}', [PlatformTenantController::class, 'updateMembership']);
        Route::prefix('community-moderation')->middleware('permission:community.moderate_platform')->group(function (): void {
            Route::get('/summary', [PlatformCommunityModerationController::class, 'summary']);
            Route::get('/reports/{communityReport}', [PlatformCommunityModerationController::class, 'show']);
            Route::post('/reports/{communityReport}/decision', [PlatformCommunityModerationController::class, 'intervene']);
        });
    });
    Route::prefix('v1/tenant')->middleware(['platform.owner', 'permission:tenant.settings.manage'])->group(function (): void {
        Route::patch('/branding', [TenantSettingsController::class, 'updateBranding']);
        Route::post('/domains', [TenantSettingsController::class, 'storeDomain']);
        Route::put('/features/{featureKey}', [TenantSettingsController::class, 'updateFeature']);
        Route::post('/schools', [TenantSettingsController::class, 'storeSchool']);
        Route::put('/memberships/{user}', [TenantSettingsController::class, 'updateMembership']);
    });
    Route::get('/dashboard/school', [DashboardController::class, 'school'])
        ->middleware('permission:fee_record.view');
    Route::post('/invoices/generate-monthly', [InvoiceGenerationController::class, 'store'])
        ->middleware('permission:fee_record.generate');

    Route::get('/audit-logs', [AuditLogController::class, 'index'])
        ->middleware('permission:audit.view');
    Route::get('/audit-logs/{auditLog}', [AuditLogController::class, 'show'])
        ->middleware('permission:audit.view');
    Route::get('/application-logs', [ApplicationLogController::class, 'index'])
        ->middleware('permission:logs.view');

    Route::get('/calendar-events', [CalendarEventController::class, 'index'])
        ->middleware('permission:calendar.view');
    Route::post('/calendar-events', [CalendarEventController::class, 'store'])
        ->middleware('permission:calendar.create');
    Route::patch('/calendar-events/{calendarEvent}', [CalendarEventController::class, 'update'])
        ->middleware('permission:calendar.update');
    Route::delete('/calendar-events/{calendarEvent}', [CalendarEventController::class, 'destroy'])
        ->middleware('permission:calendar.delete');

    Route::get('/classes', [SchoolClassController::class, 'index'])
        ->middleware('permission:students.view');

    Route::get('/students', [StudentController::class, 'index'])
        ->middleware('permission:students.view');
    Route::post('/students', [StudentController::class, 'store'])
        ->middleware('permission:students.create');
    Route::get('/students/{student}', [StudentController::class, 'show'])
        ->middleware('permission:students.view');
    Route::patch('/students/{student}', [StudentController::class, 'update'])
        ->middleware('permission:students.update');
    Route::patch('/students/{student}/status', [StudentStatusController::class, 'update'])
        ->middleware('permission:students.update_status');

    Route::get('/students/{student}/fee-agreements', [StudentFeeAgreementController::class, 'index'])
        ->middleware('permission:fee_agreements.view');
    Route::post('/students/{student}/fee-agreements', [StudentFeeAgreementController::class, 'store'])
        ->middleware('permission:fee_agreements.create');
    Route::get('/fee-agreements/{feeAgreement}', [FeeAgreementController::class, 'show'])
        ->middleware('permission:fee_agreements.view');
    Route::post('/fee-agreements/{feeAgreement}/supersede', [FeeAgreementController::class, 'supersede'])
        ->middleware('permission:fee_agreements.update');

    Route::get('/fee-items', [FeeItemController::class, 'index'])
        ->middleware('permission:fee_items.view');

    Route::get('/fee-record/summary', [FeeRecordController::class, 'summary'])
        ->middleware('permission:fee_record.view');
    Route::get('/fee-record/category-monthly', [FeeRecordController::class, 'categoryMonthly'])
        ->middleware('permission:fee_record.view');

    Route::get('/students/{student}/fee-record/preview', [FeeRecordController::class, 'preview'])
        ->middleware('permission:fee_record.view');
    Route::post('/students/{student}/fee-record/activate', [FeeRecordController::class, 'activate'])
        ->middleware('permission:fee_record.generate');
    Route::post('/students/{student}/fee-record/manual-charges', [FeeRecordController::class, 'storeManualCharge'])
        ->middleware('permission:fee_record.manage');
    Route::get('/students/{student}/fee-record/outstanding', [FeeRecordController::class, 'outstanding'])
        ->middleware('permission:fee_record.view');

    Route::get('/students/{student}/payments', [PaymentController::class, 'index'])
        ->middleware('permission:payments.view');
    Route::post('/students/{student}/payments', [PaymentController::class, 'store'])
        ->middleware('permission:payments.create');
    Route::post('/students/{student}/payment-reminders', [PaymentReminderController::class, 'store'])
        ->middleware('permission:payment_reminders.send');
    Route::post('/payments/{payment}/verify', [PaymentController::class, 'verify'])
        ->middleware('permission:payments.verify');
    Route::post('/payments/{payment}/void', [PaymentController::class, 'void'])
        ->middleware('permission:payments.void');

    Route::get('/students/{student}/receipts', [ReceiptController::class, 'index'])
        ->middleware('permission:receipts.view');
    Route::post('/payments/{payment}/receipts', [ReceiptController::class, 'store'])
        ->middleware('permission:receipts.create');
    Route::get('/receipts/{receipt}', [ReceiptController::class, 'show'])
        ->middleware('permission:receipts.view');
    Route::get('/receipts/{receipt}/print', [ReceiptController::class, 'print'])
        ->middleware('permission:receipts.print');
    Route::post('/receipts/{receipt}/void', [ReceiptController::class, 'void'])
        ->middleware('permission:receipts.void');
});

Route::prefix('v1')->middleware([...$sessionMiddleware, 'auth', 'active', 'tenant.member', 'school.context'])->group(function (): void {
    Route::prefix('community')->middleware(['tenant.surface:app', 'tenant.feature:community', 'permission:community.view'])->group(function (): void {
        Route::get('/posts', [CommunityController::class, 'index']);
        Route::get('/posts/{communityPost}', [CommunityController::class, 'show']);
        Route::get('/publishing-context', [CommunityController::class, 'publishingContext'])->middleware('permission:community.publish');
        Route::post('/audience-preview', [CommunityController::class, 'audiencePreview'])->middleware('permission:community.publish');
        Route::get('/policies/current', [CommunitySafetyController::class, 'currentPolicies']);
        Route::post('/policies/{communityPolicyVersion}/accept', [CommunitySafetyController::class, 'acceptPolicy']);
        Route::post('/reports', [CommunitySafetyController::class, 'storeReport']);
        Route::get('/reports/mine', [CommunitySafetyController::class, 'myReports']);
        Route::post('/posts', [CommunityController::class, 'store'])->middleware('permission:community.publish');
        Route::put('/posts/{communityPost}', [CommunityController::class, 'update'])->middleware('permission:community.publish,community.moderate');
        Route::delete('/posts/{communityPost}', [CommunityController::class, 'destroy'])->middleware('permission:community.publish,community.moderate');
        Route::post('/posts/{communityPost}/reaction', [CommunityController::class, 'reaction']);
        Route::get('/media/{communityPostMedia}', [CommunityController::class, 'media']);
        Route::post('/posts/{communityPost}/hide', [CommunityController::class, 'hide'])->middleware('permission:community.moderate');
    });

    Route::prefix('admin')->middleware('tenant.surface:admin')->group(function (): void {
        Route::get('/settings/school-information', [SchoolSettingsController::class, 'schoolInformation']);
        Route::put('/settings/school-information', [SchoolSettingsController::class, 'updateSchoolInformation'])->middleware('permission:school.settings.manage');
        Route::get('/settings/app-support', [SchoolSettingsController::class, 'appSupport']);
        Route::put('/settings/app-support', [SchoolSettingsController::class, 'updateAppSupport'])->middleware('permission:school.settings.manage');

        Route::prefix('community-moderation')->middleware('permission:community.moderate')->group(function (): void {
            Route::get('/reports', [CommunityModerationController::class, 'index']);
            Route::get('/reports/{communityReport}', [CommunityModerationController::class, 'show']);
            Route::post('/reports/{communityReport}/decision', [CommunityModerationController::class, 'decide']);
        });
        Route::get('/academic-years', [AcademicYearController::class, 'index'])->middleware('permission:academic_years.view');
        Route::post('/academic-years', [AcademicYearController::class, 'store'])->middleware('permission:academic_years.manage');
        Route::patch('/academic-years/{academicYear}', [AcademicYearController::class, 'update'])->middleware('permission:academic_years.manage');
        Route::post('/academic-years/{academicYear}/activate', [AcademicYearController::class, 'activate'])->middleware('permission:academic_years.manage');
        Route::get('/academic-terms', [AcademicTermController::class, 'index'])->middleware('permission:assessments.manage_school');
        Route::post('/academic-terms', [AcademicTermController::class, 'store'])->middleware('permission:assessments.manage_school');
        Route::patch('/academic-terms/{academicTerm}', [AcademicTermController::class, 'update'])->middleware('permission:assessments.manage_school');

        Route::get('/subjects', [SubjectController::class, 'index'])->middleware('permission:subjects.view');
        Route::post('/subjects', [SubjectController::class, 'store'])->middleware('permission:subjects.manage');
        Route::patch('/subjects/{subject}', [SubjectController::class, 'update'])->middleware('permission:subjects.manage');

        Route::get('/class-enrolments', [ClassEnrolmentController::class, 'index'])->middleware('permission:class_enrolments.view');
        Route::post('/class-enrolments', [ClassEnrolmentController::class, 'store'])->middleware('permission:class_enrolments.manage');
        Route::post('/class-enrolments/{classEnrolment}/end', [ClassEnrolmentController::class, 'end'])->middleware('permission:class_enrolments.manage');

        Route::get('/teaching-assignments', [TeachingAssignmentController::class, 'index'])->middleware('permission:teaching_assignments.view');
        Route::post('/teaching-assignments', [TeachingAssignmentController::class, 'store'])->middleware('permission:teaching_assignments.manage');
        Route::post('/teaching-assignments/{teachingAssignment}/end', [TeachingAssignmentController::class, 'end'])->middleware('permission:teaching_assignments.manage');

        Route::get('/class-schedules', [ClassScheduleController::class, 'index'])->middleware(['tenant.feature:schedule', 'permission:schedule.manage']);
        Route::post('/class-schedules', [ClassScheduleController::class, 'store'])->middleware(['tenant.feature:schedule', 'permission:schedule.manage']);
        Route::patch('/class-schedules/{classScheduleEntry}', [ClassScheduleController::class, 'update'])->middleware(['tenant.feature:schedule', 'permission:schedule.manage']);

        Route::get('/attendance/overview', [AdminAttendanceController::class, 'showOverview'])->middleware(['tenant.feature:attendance', 'permission:attendance.view_school']);
        Route::get('/attendance/daily', [AdminAttendanceController::class, 'showDaily'])->middleware(['tenant.feature:attendance', 'permission:attendance.view_school']);
        Route::post('/attendance/daily', [AdminAttendanceController::class, 'storeDaily'])->middleware(['tenant.feature:attendance', 'permission:attendance.manage_school']);
        Route::get('/attendance/campus-records', [CampusAttendanceController::class, 'index'])->middleware(['tenant.feature:attendance', 'permission:attendance.view_school']);
        Route::post('/attendance/gate-event', [CampusAttendanceController::class, 'store'])->middleware(['tenant.feature:attendance', 'permission:attendance.manage_school']);
        Route::post('/attendance/gate-events/batch', [CampusAttendanceController::class, 'storeBatch'])->middleware(['tenant.feature:attendance', 'permission:attendance.manage_school']);
        Route::get('/attendance/devices', [CampusAttendanceController::class, 'devices'])->middleware(['tenant.feature:attendance', 'permission:attendance.devices.manage']);
        Route::post('/attendance/devices', [CampusAttendanceController::class, 'storeDevice'])->middleware(['tenant.feature:attendance', 'permission:attendance.devices.manage']);
        Route::patch('/attendance/devices/{attendanceDevice}', [CampusAttendanceController::class, 'updateDevice'])->middleware(['tenant.feature:attendance', 'permission:attendance.devices.manage']);
        Route::get('/attendance/settings', [CampusAttendanceController::class, 'settings'])->middleware(['tenant.feature:attendance', 'permission:attendance.devices.manage']);
        Route::put('/attendance/settings', [CampusAttendanceController::class, 'updateSettings'])->middleware(['tenant.feature:attendance', 'permission:attendance.devices.manage']);
        Route::get('/attendance/abilities', [AttendanceAbilityController::class, 'index'])->middleware(['tenant.feature:attendance', 'permission:attendance.abilities.manage']);
        Route::post('/attendance/abilities', [AttendanceAbilityController::class, 'store'])->middleware(['tenant.feature:attendance', 'permission:attendance.abilities.manage']);
        Route::delete('/attendance/abilities/{userAttendanceAbility}', [AttendanceAbilityController::class, 'destroy'])->middleware(['tenant.feature:attendance', 'permission:attendance.abilities.manage']);

        Route::patch('/parents/{guardian}/portal-user', [PortalLinkController::class, 'guardianUser'])->middleware('permission:portal_links.manage');
        Route::patch('/students/{student}/portal-user', [PortalLinkController::class, 'studentUser'])->middleware('permission:portal_links.manage');
        Route::patch('/student-parent-links/{studentParentLink}/portal-access', [PortalLinkController::class, 'guardianAccess'])->middleware('permission:portal_links.manage');
        Route::patch('/users/{user}/foundation-roles', [FoundationAccountController::class, 'roles'])->middleware('permission:foundation_accounts.manage');
        Route::post('/users', [FoundationAccountController::class, 'store'])->middleware('permission:foundation_accounts.manage');
        Route::get('/staff', [StaffController::class, 'index'])->middleware('permission:employees.view');
        Route::post('/staff', [StaffController::class, 'store'])->middleware('permission:employees.manage');
        Route::get('/staff/{user}/access', [EmployeeAccessController::class, 'show'])->middleware('permission:employees.abilities.manage');
        Route::put('/staff/{user}/access', [EmployeeAccessController::class, 'update'])->middleware('permission:employees.abilities.manage');
    });

    Route::prefix('teacher')->middleware(['tenant.surface:app', 'permission:app.teacher_access'])->group(function (): void {
        Route::get('/teaching-assignments', [TeacherScopeController::class, 'assignments'])->middleware('permission:teaching_scope.view');
        Route::get('/classes/{schoolClass}/students', [TeacherScopeController::class, 'students'])->middleware('permission:teaching_scope.view');
        Route::get('/school/teaching-assignments', [TeacherScopeController::class, 'schoolAssignments'])->middleware('permission:teaching_assignments.view');
        Route::get('/school/teaching-assignments/{teachingAssignment}/students', [TeacherScopeController::class, 'schoolStudents'])->middleware('permission:class_enrolments.view');
        Route::get('/attendance/daily', [TeacherAttendanceController::class, 'showDaily'])->middleware(['tenant.feature:attendance', 'permission:attendance.view_assigned']);
        Route::post('/attendance/daily', [TeacherAttendanceController::class, 'storeDaily'])->middleware(['tenant.feature:attendance', 'permission:attendance.manage_assigned']);
        Route::get('/attendance/campus-records', [CampusAttendanceController::class, 'teacherIndex'])->middleware(['tenant.feature:attendance', 'permission:attendance.view_assigned']);
    });

    Route::prefix('assessments')->middleware(['tenant.surface:app', 'tenant.feature:assessments', 'permission:assessments.manage'])->group(function (): void {
        Route::get('/', [AssessmentController::class, 'index']);
        Route::post('/', [AssessmentController::class, 'store']);
        Route::put('/{assessment}/results', [AssessmentController::class, 'saveResults']);
        Route::post('/{assessment}/publish', [AssessmentController::class, 'publish']);
    });

    Route::prefix('quizzes')->middleware(['tenant.surface:app', 'tenant.feature:formal_quiz', 'permission:quizzes.manage'])->group(function (): void {
        Route::post('/', [QuizController::class, 'store']);
        Route::post('/{quiz}/assignments', [QuizController::class, 'assign']);
        Route::post('/assignments/{quizAssignment}/publish', [QuizController::class, 'publish']);
    });

    Route::prefix('portal')->middleware('tenant.surface:app')->group(function (): void {
        // Parent portal — requires active guardian link per resource
        Route::prefix('parent')->middleware('permission:parent.self_service')->group(function (): void {
            Route::get('/me', [ParentPortalController::class, 'me']);
            Route::get('/children/{student}/outstanding', [ParentPortalController::class, 'childOutstanding'])->middleware('tenant.feature:parent_finance');
            Route::get('/children/{student}/payments', [ParentPortalController::class, 'childPayments'])->middleware('tenant.feature:parent_finance');
            Route::get('/children/{student}/receipts', [ParentPortalController::class, 'childReceipts'])->middleware('tenant.feature:parent_finance');
            Route::get('/children/{student}/receipts/{receipt}', [ParentPortalController::class, 'childReceipt'])->middleware('tenant.feature:parent_finance');
            Route::get('/children/{student}/attendance', [ParentPortalController::class, 'childAttendance'])->middleware('tenant.feature:attendance');
            Route::get('/children/{student}/campus-attendance', [ParentPortalController::class, 'childCampusAttendance'])->middleware('tenant.feature:attendance');
            Route::get('/children/{student}/assessment-results', [ParentPortalController::class, 'childAssessmentResults'])->middleware(['tenant.feature:assessments', 'permission:assessments.view_published']);
            Route::get('/children/{student}/schedule', [ParentPortalController::class, 'childSchedule'])->middleware(['tenant.feature:schedule', 'permission:schedule.view']);
        });

        // Student portal — requires active student-self link
        Route::prefix('student')->middleware('permission:student.self_service')->group(function (): void {
            Route::get('/me', [StudentPortalController::class, 'me']);
            Route::get('/enrolments', [StudentPortalController::class, 'enrolments']);
            Route::get('/assessment-results', [StudentPortalController::class, 'assessmentResults'])->middleware(['tenant.feature:assessments', 'permission:assessments.view_published']);
            Route::get('/schedule', [StudentPortalController::class, 'schedule'])->middleware(['tenant.feature:schedule', 'permission:schedule.view']);
            Route::prefix('quizzes')->middleware(['tenant.feature:formal_quiz', 'permission:quizzes.attempt'])->group(function (): void {
                Route::get('/', [QuizController::class, 'studentIndex']);
                Route::post('/assignments/{quizAssignment}/attempts', [QuizController::class, 'start']);
                Route::post('/attempts/{quizAttempt}/submit', [QuizController::class, 'submit']);
            });
        });

        // In-app notifications — available to both parent and student
        Route::prefix('notifications')->middleware('tenant.feature:notifications')->group(function (): void {
            Route::get('/', [PortalNotificationController::class, 'index']);
            Route::patch('/{portalNotification}/read', [PortalNotificationController::class, 'markRead']);
            Route::post('/mark-all-read', [PortalNotificationController::class, 'markAllRead']);
        });
    });
});
