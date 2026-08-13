<?php

use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CalendarEventController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\FeeAgreementController;
use App\Http\Controllers\Api\FeeItemController;
use App\Http\Controllers\Api\FeeRecordController;
use App\Http\Controllers\Api\InvoiceGenerationController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ReceiptController;
use App\Http\Controllers\Api\SchoolClassController;
use App\Http\Controllers\Api\StudentController;
use App\Http\Controllers\Api\StudentFeeAgreementController;
use App\Http\Controllers\Api\StudentStatusController;
use App\Http\Controllers\Api\V1\AcademicYearController;
use App\Http\Controllers\Api\V1\ClassEnrolmentController;
use App\Http\Controllers\Api\V1\CommunityController;
use App\Http\Controllers\Api\V1\FoundationAccountController;
use App\Http\Controllers\Api\V1\ParentPortalController;
use App\Http\Controllers\Api\V1\PortalLinkController;
use App\Http\Controllers\Api\V1\PortalNotificationController;
use App\Http\Controllers\Api\V1\StaffController;
use App\Http\Controllers\Api\V1\StudentPortalController;
use App\Http\Controllers\Api\V1\SubjectController;
use App\Http\Controllers\Api\V1\TeacherAttendanceController;
use App\Http\Controllers\Api\V1\TeacherScopeController;
use App\Http\Controllers\Api\V1\TeachingAssignmentController;
use App\Http\Controllers\DeploymentInfoController;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;

Route::get('/deployment-info', DeploymentInfoController::class)->name('deployment-info');

$sessionMiddleware = [
    EncryptCookies::class,
    AddQueuedCookiesToResponse::class,
    StartSession::class,
    PreventRequestForgery::class,
];

Route::middleware($sessionMiddleware)->group(function (): void {
    Route::get('/csrf-cookie', fn () => response()->noContent());
    Route::post('/login', [AuthController::class, 'login']);

    Route::middleware(['auth', 'active'])->group(function (): void {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});

Route::middleware([...$sessionMiddleware, 'auth', 'active'])->group(function (): void {
    Route::get('/dashboard/school', [DashboardController::class, 'school'])
        ->middleware('permission:fee_record.view');
    Route::post('/invoices/generate-monthly', [InvoiceGenerationController::class, 'store'])
        ->middleware('permission:fee_record.generate');

    Route::get('/audit-logs', [AuditLogController::class, 'index'])
        ->middleware('permission:audit.view');
    Route::get('/audit-logs/{auditLog}', [AuditLogController::class, 'show'])
        ->middleware('permission:audit.view');

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

Route::prefix('v1')->middleware([...$sessionMiddleware, 'auth', 'active', 'school.context'])->group(function (): void {
    Route::prefix('community')->middleware('permission:community.view')->group(function (): void {
        Route::get('/posts', [CommunityController::class, 'index']);
        Route::post('/posts', [CommunityController::class, 'store'])->middleware('permission:community.publish');
        Route::post('/posts/{communityPost}/reaction', [CommunityController::class, 'reaction'])->middleware('permission:community.interact');
        Route::post('/posts/{communityPost}/comments', [CommunityController::class, 'comment'])->middleware('permission:community.interact');
        Route::get('/media/{communityPostMedia}', [CommunityController::class, 'media']);
        Route::delete('/comments/{communityComment}', [CommunityController::class, 'removeComment'])->middleware('permission:community.interact');
        Route::post('/posts/{communityPost}/hide', [CommunityController::class, 'hide'])->middleware('permission:community.moderate');
    });

    Route::prefix('admin')->group(function (): void {
        Route::get('/academic-years', [AcademicYearController::class, 'index'])->middleware('permission:academic_years.view');
        Route::post('/academic-years', [AcademicYearController::class, 'store'])->middleware('permission:academic_years.manage');
        Route::patch('/academic-years/{academicYear}', [AcademicYearController::class, 'update'])->middleware('permission:academic_years.manage');
        Route::post('/academic-years/{academicYear}/activate', [AcademicYearController::class, 'activate'])->middleware('permission:academic_years.manage');

        Route::get('/subjects', [SubjectController::class, 'index'])->middleware('permission:subjects.view');
        Route::post('/subjects', [SubjectController::class, 'store'])->middleware('permission:subjects.manage');
        Route::patch('/subjects/{subject}', [SubjectController::class, 'update'])->middleware('permission:subjects.manage');

        Route::get('/class-enrolments', [ClassEnrolmentController::class, 'index'])->middleware('permission:class_enrolments.view');
        Route::post('/class-enrolments', [ClassEnrolmentController::class, 'store'])->middleware('permission:class_enrolments.manage');
        Route::post('/class-enrolments/{classEnrolment}/end', [ClassEnrolmentController::class, 'end'])->middleware('permission:class_enrolments.manage');

        Route::get('/teaching-assignments', [TeachingAssignmentController::class, 'index'])->middleware('permission:teaching_assignments.view');
        Route::post('/teaching-assignments', [TeachingAssignmentController::class, 'store'])->middleware('permission:teaching_assignments.manage');
        Route::post('/teaching-assignments/{teachingAssignment}/end', [TeachingAssignmentController::class, 'end'])->middleware('permission:teaching_assignments.manage');

        Route::patch('/parents/{guardian}/portal-user', [PortalLinkController::class, 'guardianUser'])->middleware('permission:portal_links.manage');
        Route::patch('/students/{student}/portal-user', [PortalLinkController::class, 'studentUser'])->middleware('permission:portal_links.manage');
        Route::patch('/student-parent-links/{studentParentLink}/portal-access', [PortalLinkController::class, 'guardianAccess'])->middleware('permission:portal_links.manage');
        Route::patch('/users/{user}/foundation-roles', [FoundationAccountController::class, 'roles'])->middleware('permission:foundation_accounts.manage');
        Route::post('/users', [FoundationAccountController::class, 'store'])->middleware('permission:foundation_accounts.manage');
        Route::get('/staff', [StaffController::class, 'index'])->middleware('permission:foundation_accounts.manage');
        Route::post('/staff', [StaffController::class, 'store'])->middleware('permission:foundation_accounts.manage');
    });

    Route::prefix('teacher')->middleware('permission:teaching_scope.view')->group(function (): void {
        Route::get('/teaching-assignments', [TeacherScopeController::class, 'assignments']);
        Route::get('/classes/{schoolClass}/students', [TeacherScopeController::class, 'students']);
        Route::get('/attendance/daily', [TeacherAttendanceController::class, 'showDaily']);
        Route::post('/attendance/daily', [TeacherAttendanceController::class, 'storeDaily']);
    });

    Route::prefix('portal')->group(function (): void {
        // Parent portal — requires active guardian link per resource
        Route::prefix('parent')->middleware('permission:parent.self_service')->group(function (): void {
            Route::get('/me', [ParentPortalController::class, 'me']);
            Route::get('/children/{student}/outstanding', [ParentPortalController::class, 'childOutstanding']);
            Route::get('/children/{student}/payments', [ParentPortalController::class, 'childPayments']);
            Route::get('/children/{student}/receipts', [ParentPortalController::class, 'childReceipts']);
            Route::get('/children/{student}/attendance', [ParentPortalController::class, 'childAttendance']);
        });

        // Student portal — requires active student-self link
        Route::prefix('student')->middleware('permission:student.self_service')->group(function (): void {
            Route::get('/me', [StudentPortalController::class, 'me']);
            Route::get('/enrolments', [StudentPortalController::class, 'enrolments']);
            Route::get('/attendance', [StudentPortalController::class, 'attendance']);
        });

        // In-app notifications — available to both parent and student
        Route::prefix('notifications')->group(function (): void {
            Route::get('/', [PortalNotificationController::class, 'index']);
            Route::patch('/{portalNotification}/read', [PortalNotificationController::class, 'markRead']);
            Route::post('/mark-all-read', [PortalNotificationController::class, 'markAllRead']);
        });
    });
});
