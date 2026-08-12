<?php

namespace Database\Seeders;

use App\Models\DiscountItem;
use App\Models\FeeItem;
use App\Models\Guardian;
use App\Models\Permission;
use App\Models\Role;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\StudentDiscountAssignment;
use App\Models\StudentFeeAssignment;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $school = School::query()->updateOrCreate(
            ['code' => 'DEMO'],
            [
                'name' => 'Demo International School',
                'receipt_prefix' => 'DEMO',
                'invoice_prefix' => 'DEMO-INV',
                'email' => 'admin@demo-school.test',
                'phone' => '+60 3-0000 0000',
                'address' => 'Fictional demo school, Malaysia',
                'status' => 'active',
            ],
        );

        $this->call(SchoolClassSeeder::class);

        $roles = collect([
            'super-admin' => 'Super Admin',
            'ceo' => 'CEO',
            'school-admin' => 'School Admin',
            'finance' => 'Finance',
            'teacher' => 'Teacher',
            'parent' => 'Parent',
            'student' => 'Student',
        ])->mapWithKeys(fn (string $name, string $slug) => [
            $slug => Role::query()->updateOrCreate(['slug' => $slug], ['name' => $name]),
        ]);

        $superAdmin = User::query()->updateOrCreate(
            ['username' => 'superadmin'],
            [
                'school_id' => $school->id,
                'name' => 'Demo Super Admin',
                'password' => Hash::make('password'),
                'status' => 'active',
            ],
        );

        $admin = User::query()->updateOrCreate(
            ['username' => 'admin'],
            [
                'school_id' => $school->id,
                'name' => 'Demo School Admin',
                'password' => Hash::make('password'),
                'status' => 'active',
            ],
        );

        $finance = User::query()->updateOrCreate(
            ['username' => 'finance'],
            [
                'school_id' => $school->id,
                'name' => 'Demo Finance Admin',
                'password' => Hash::make('password'),
                'status' => 'active',
            ],
        );

        $permissions = collect([
            'students.view' => 'View students',
            'students.create' => 'Create students',
            'students.update' => 'Update students',
            'students.update_status' => 'Update student status',
            'parents.view' => 'View parents',
            'parents.create' => 'Create parents',
            'parents.update' => 'Update parents',
            'fee_items.view' => 'View fee items',
            'fee_items.manage' => 'Manage fee items',
            'fee_agreements.view' => 'View fee agreements',
            'fee_agreements.create' => 'Create fee agreements',
            'fee_agreements.update' => 'Update fee agreements',
            'fee_record.view' => 'View fee record',
            'fee_record.generate' => 'Generate fee record charges',
            'fee_record.manage' => 'Manage fee record',
            'payments.view' => 'View payments',
            'payments.create' => 'Create payments',
            'payments.verify' => 'Verify payments',
            'payments.void' => 'Void payments',
            'receipts.view' => 'View receipts',
            'receipts.create' => 'Create receipts',
            'receipts.void' => 'Void receipts',
            'receipts.print' => 'Print receipts',
            'calendar.view' => 'View calendar events',
            'calendar.create' => 'Create calendar events',
            'calendar.update' => 'Update calendar events',
            'calendar.delete' => 'Delete calendar events',
            'audit.view' => 'View global audit logs',
            'audit.correct_generic' => 'Correct approved low-risk fields from audit history',
            'academic_years.view' => 'View academic years',
            'academic_years.manage' => 'Manage academic years',
            'class_enrolments.view' => 'View class enrolments',
            'class_enrolments.manage' => 'Manage class enrolments',
            'subjects.view' => 'View subjects',
            'subjects.manage' => 'Manage subjects',
            'teaching_assignments.view' => 'View teaching assignments',
            'teaching_assignments.manage' => 'Manage teaching assignments',
            'teaching_scope.view' => 'View own teaching scope',
            'portal_links.manage' => 'Manage portal identity and guardian access links',
            'parent.self_service' => 'Access parent self-service',
            'student.self_service' => 'Access student academic self-service',
        ])->mapWithKeys(fn (string $name, string $slug) => [
            $slug => Permission::query()->updateOrCreate(['slug' => $slug], ['name' => $name]),
        ]);

        $roles['super-admin']->permissions()->sync($permissions->pluck('id')->all());
        $roles['ceo']->permissions()->sync($permissions->only([
            'fee_record.view',
            'calendar.view',
        ])->pluck('id')->all());
        $roles['school-admin']->permissions()->sync($permissions->only([
            'students.view',
            'students.create',
            'students.update',
            'students.update_status',
            'parents.view',
            'parents.create',
            'parents.update',
            'fee_items.view',
            'fee_agreements.view',
            'fee_agreements.create',
            'fee_agreements.update',
            'fee_record.view',
            'fee_record.generate',
            'fee_record.manage',
            'payments.view',
            'payments.create',
            'receipts.view',
            'receipts.create',
            'receipts.print',
            'calendar.view',
            'calendar.create',
            'calendar.update',
            'calendar.delete',
            'academic_years.view',
            'academic_years.manage',
            'class_enrolments.view',
            'class_enrolments.manage',
            'subjects.view',
            'subjects.manage',
            'teaching_assignments.view',
            'teaching_assignments.manage',
            'portal_links.manage',
        ])->pluck('id')->all());
        $roles['finance']->permissions()->sync($permissions->only([
            'students.view',
            'parents.view',
            'fee_items.view',
            'fee_agreements.view',
            'fee_record.view',
            'payments.view',
            'payments.verify',
            'payments.void',
            'receipts.view',
            'receipts.create',
            'receipts.void',
            'receipts.print',
            'calendar.view',
            'calendar.create',
            'calendar.update',
            'calendar.delete',
        ])->pluck('id')->all());

        $roles['teacher']->permissions()->sync($permissions->only([
            'academic_years.view',
            'subjects.view',
            'teaching_scope.view',
        ])->pluck('id')->all());
        $roles['parent']->permissions()->sync($permissions->only([
            'parent.self_service',
        ])->pluck('id')->all());
        $roles['student']->permissions()->sync($permissions->only([
            'student.self_service',
        ])->pluck('id')->all());

        $superAdmin->roles()->sync([$roles['super-admin']->id]);
        $admin->roles()->sync([$roles['school-admin']->id]);
        $finance->roles()->sync([$roles['finance']->id]);

        $yearTwo = SchoolClass::query()
            ->where('school_id', $school->id)
            ->where('name', 'MB1')
            ->firstOrFail();

        $yearFour = SchoolClass::query()
            ->where('school_id', $school->id)
            ->where('name', 'MD1')
            ->firstOrFail();

        $tuition = FeeItem::query()->updateOrCreate(
            ['school_id' => $school->id, 'name' => 'Tuition Fee'],
            ['code' => 'TUITION', 'fee_type' => 'recurring', 'category' => 'mandatory', 'default_amount' => 800, 'status' => 'active'],
        );

        FeeItem::query()->updateOrCreate(
            ['school_id' => $school->id, 'name' => 'Misc Fee'],
            ['code' => 'MISC', 'fee_type' => 'recurring', 'category' => 'mandatory', 'default_amount' => 90, 'status' => 'active'],
        );

        $transport = FeeItem::query()->updateOrCreate(
            ['school_id' => $school->id, 'name' => 'Transport'],
            ['code' => 'TRANSPORT', 'fee_type' => 'recurring', 'category' => 'optional', 'default_amount' => 120, 'status' => 'active'],
        );

        $registration = FeeItem::query()->updateOrCreate(
            ['school_id' => $school->id, 'name' => 'Registration'],
            ['code' => 'REG', 'fee_type' => 'one_time', 'category' => 'optional', 'default_amount' => 50, 'status' => 'active'],
        );

        $siblingDiscount = DiscountItem::query()->updateOrCreate(
            ['school_id' => $school->id, 'name' => 'Sibling Discount'],
            ['discount_type' => 'percentage', 'default_value' => 10, 'status' => 'active'],
        );

        $students = [
            [
                'student_no' => 'DEMO-2026-001',
                'full_name' => 'Alyssa Tan',
                'class_id' => $yearFour->id,
                'parent' => 'Michelle Tan',
                'phone' => '+60 12-100 0001',
                'discount' => true,
            ],
            [
                'student_no' => 'DEMO-2026-002',
                'full_name' => 'Daniel Lim',
                'class_id' => $yearTwo->id,
                'parent' => 'Jonathan Lim',
                'phone' => '+60 12-100 0002',
                'discount' => false,
            ],
            [
                'student_no' => 'DEMO-2026-003',
                'full_name' => 'Mika Wong',
                'class_id' => $yearFour->id,
                'parent' => 'Rachel Wong',
                'phone' => '+60 12-100 0003',
                'discount' => false,
            ],
        ];

        foreach ($students as $studentData) {
            $student = Student::query()->updateOrCreate(
                ['school_id' => $school->id, 'student_no' => $studentData['student_no']],
                [
                    'class_id' => $studentData['class_id'],
                    'level_group' => 'primary',
                    'full_name' => $studentData['full_name'],
                    'gender' => null,
                    'registration_date' => '2026-01-08',
                    'status' => 'active',
                ],
            );

            $parent = Guardian::query()->updateOrCreate(
                ['school_id' => $school->id, 'phone' => $studentData['phone']],
                [
                    'full_name' => $studentData['parent'],
                    'email' => null,
                    'address' => 'Malaysia',
                    'emergency_contact' => $studentData['phone'],
                ],
            );

            $student->parents()->syncWithoutDetaching([
                $parent->id => [
                    'school_id' => $school->id,
                    'relationship' => 'guardian',
                    'is_primary_contact' => true,
                ],
            ]);

            foreach ([$tuition, $transport] as $feeItem) {
                StudentFeeAssignment::query()->updateOrCreate(
                    [
                        'school_id' => $school->id,
                        'student_id' => $student->id,
                        'fee_item_id' => $feeItem->id,
                    ],
                    [
                        'amount' => $feeItem->default_amount,
                        'status' => 'active',
                    ],
                );
            }

            if ($student->student_no === 'DEMO-2026-001') {
                StudentFeeAssignment::query()->updateOrCreate(
                    [
                        'school_id' => $school->id,
                        'student_id' => $student->id,
                        'fee_item_id' => $registration->id,
                    ],
                    [
                        'amount' => $registration->default_amount,
                        'billing_month' => '2026-07',
                        'status' => 'active',
                    ],
                );
            }

            if ($studentData['discount']) {
                StudentDiscountAssignment::query()->updateOrCreate(
                    [
                        'school_id' => $school->id,
                        'student_id' => $student->id,
                        'discount_item_id' => $siblingDiscount->id,
                    ],
                    [
                        'discount_type' => 'percentage',
                        'value' => 10,
                        'status' => 'active',
                        'reason' => 'Sibling discount',
                    ],
                );
            }
        }

        if (! app()->environment('testing')) {
            $this->call(DemoScenarioSeeder::class);
        }
    }
}
