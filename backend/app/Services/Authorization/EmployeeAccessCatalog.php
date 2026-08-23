<?php

namespace App\Services\Authorization;

final class EmployeeAccessCatalog
{
    public const POSITIONS = ['school-admin', 'finance', 'teacher'];

    /** @return array<string, array<int, array{slug:string,label:string}>> */
    public function groups(): array
    {
        return [
            'Students' => $this->items([
                'students.view' => 'View students', 'students.create' => 'Create students', 'students.update' => 'Edit students',
                'students.update_status' => 'Change student status', 'parents.view' => 'View parents', 'parents.create' => 'Create parents', 'parents.update' => 'Edit parents',
            ]),
            'Classes' => $this->items([
                'class_enrolments.view' => 'View class enrolments', 'class_enrolments.manage' => 'Manage class enrolments',
                'teaching_assignments.view' => 'View teaching assignments', 'teaching_assignments.manage' => 'Manage teaching assignments', 'teaching_scope.view' => 'View assigned teaching scope',
            ]),
            'Attendance' => $this->items([
                'attendance.view_assigned' => 'View assigned-class Attendance', 'attendance.manage_assigned' => 'Manage assigned-class Attendance',
                'attendance.view_school' => 'View whole-school Attendance', 'attendance.manage_school' => 'Manage whole-school Attendance',
                'attendance.devices.manage' => 'Manage Attendance devices and settings', 'attendance.abilities.manage' => 'Manage Attendance access',
            ]),
            'Calendar' => $this->items([
                'calendar.view' => 'View calendar', 'calendar.create' => 'Create events', 'calendar.update' => 'Edit events', 'calendar.delete' => 'Delete events',
            ]),
            'Finance' => $this->items([
                'fee_items.view' => 'View fee items', 'fee_items.manage' => 'Manage fee items', 'fee_agreements.view' => 'View fee agreements',
                'fee_agreements.create' => 'Create fee agreements', 'fee_agreements.update' => 'Supersede fee agreements', 'fee_record.view' => 'View fee records',
                'fee_record.generate' => 'Generate fee charges', 'fee_record.manage' => 'Manage fee records', 'payments.view' => 'View payments',
                'payments.create' => 'Record payments', 'payments.verify' => 'Verify payments', 'payments.void' => 'Void payments',
                'payment_reminders.send' => 'Send payment reminders', 'receipts.view' => 'View receipts', 'receipts.create' => 'Create receipts',
                'receipts.void' => 'Void receipts', 'receipts.print' => 'Print receipts',
            ]),
            'Community' => $this->items([
                'community.view' => 'View Community', 'community.publish' => 'Publish posts', 'community.interact' => 'Interact with posts', 'community.moderate' => 'Moderate school Community',
            ]),
            'Academics' => $this->items([
                'academic_years.view' => 'View academic years', 'academic_years.manage' => 'Manage academic years', 'subjects.view' => 'View subjects', 'subjects.manage' => 'Manage subjects',
                'assessments.manage' => 'Manage assigned assessments', 'assessments.manage_school' => 'Manage school assessments', 'schedule.view' => 'View schedules',
                'schedule.manage' => 'Manage schedules', 'quizzes.manage' => 'Manage assigned quizzes', 'quizzes.manage_school' => 'Manage school quizzes',
            ]),
            'Employees' => $this->items([
                'employees.view' => 'View employees', 'employees.manage' => 'Create and manage employees', 'employees.abilities.manage' => 'Manage positions and User Abilities',
                'portal_links.manage' => 'Manage parent and student App links', 'foundation_accounts.manage' => 'Manage App identities',
            ]),
        ];
    }

    /** @return array<int, string> */
    public function slugs(): array
    {
        return collect($this->groups())->flatten(1)->pluck('slug')->push('app.teacher_access')->unique()->values()->all();
    }

    /** @return array<string, string> */
    public function dependencies(): array
    {
        return [
            'students.create' => 'students.view', 'students.update' => 'students.view', 'students.update_status' => 'students.view',
            'parents.create' => 'parents.view', 'parents.update' => 'parents.view', 'class_enrolments.manage' => 'class_enrolments.view',
            'teaching_assignments.manage' => 'teaching_assignments.view', 'attendance.manage_assigned' => 'attendance.view_assigned',
            'attendance.manage_school' => 'attendance.view_school', 'calendar.create' => 'calendar.view', 'calendar.update' => 'calendar.view', 'calendar.delete' => 'calendar.view',
            'fee_items.manage' => 'fee_items.view', 'fee_agreements.create' => 'fee_agreements.view', 'fee_agreements.update' => 'fee_agreements.view',
            'fee_record.generate' => 'fee_record.view', 'fee_record.manage' => 'fee_record.view', 'payments.create' => 'payments.view',
            'payments.verify' => 'payments.view', 'payments.void' => 'payments.view', 'receipts.create' => 'receipts.view', 'receipts.void' => 'receipts.view', 'receipts.print' => 'receipts.view',
            'community.publish' => 'community.view', 'community.interact' => 'community.view', 'community.moderate' => 'community.view',
            'academic_years.manage' => 'academic_years.view', 'subjects.manage' => 'subjects.view', 'schedule.manage' => 'schedule.view',
            'employees.manage' => 'employees.view', 'employees.abilities.manage' => 'employees.view',
        ];
    }

    /** @param array<string, string> $items */
    private function items(array $items): array
    {
        return collect($items)->map(fn (string $label, string $slug): array => compact('slug', 'label'))->values()->all();
    }
}
