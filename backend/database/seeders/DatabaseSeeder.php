<?php

namespace Database\Seeders;

use App\Models\DiscountItem;
use App\Models\FeeItem;
use App\Models\Guardian;
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
            ['code' => 'MIS'],
            [
                'name' => 'Matahari International School',
                'receipt_prefix' => 'MIS',
                'invoice_prefix' => 'MIS-INV',
                'email' => 'admin@mis.edu.my',
                'phone' => '+60 3-0000 0000',
                'address' => 'Matahari International School, Malaysia',
                'status' => 'active',
            ],
        );

        $roles = collect([
            'super-admin' => 'Super Admin',
            'ceo' => 'CEO',
            'school-admin' => 'School Admin',
            'finance' => 'Finance',
        ])->mapWithKeys(fn (string $name, string $slug) => [
            $slug => Role::query()->updateOrCreate(['slug' => $slug], ['name' => $name]),
        ]);

        $admin = User::query()->updateOrCreate(
            ['email' => 'admin@mis.test'],
            [
                'school_id' => $school->id,
                'name' => 'MIS School Admin',
                'password' => Hash::make('password'),
                'status' => 'active',
            ],
        );

        $finance = User::query()->updateOrCreate(
            ['email' => 'finance@mis.test'],
            [
                'school_id' => $school->id,
                'name' => 'MIS Finance Admin',
                'password' => Hash::make('password'),
                'status' => 'active',
            ],
        );

        $admin->roles()->syncWithoutDetaching([$roles['school-admin']->id]);
        $finance->roles()->syncWithoutDetaching([$roles['finance']->id]);

        $yearTwo = SchoolClass::query()->updateOrCreate(
            ['school_id' => $school->id, 'name' => 'Year 2'],
            ['status' => 'active'],
        );

        $yearFour = SchoolClass::query()->updateOrCreate(
            ['school_id' => $school->id, 'name' => 'Year 4'],
            ['status' => 'active'],
        );

        $tuition = FeeItem::query()->updateOrCreate(
            ['school_id' => $school->id, 'name' => 'Tuition Fee'],
            ['code' => 'TUITION', 'fee_type' => 'recurring', 'default_amount' => 800, 'status' => 'active'],
        );

        $transport = FeeItem::query()->updateOrCreate(
            ['school_id' => $school->id, 'name' => 'Transport'],
            ['code' => 'TRANSPORT', 'fee_type' => 'recurring', 'default_amount' => 120, 'status' => 'active'],
        );

        $registration = FeeItem::query()->updateOrCreate(
            ['school_id' => $school->id, 'name' => 'Registration'],
            ['code' => 'REG', 'fee_type' => 'one_time', 'default_amount' => 50, 'status' => 'active'],
        );

        $siblingDiscount = DiscountItem::query()->updateOrCreate(
            ['school_id' => $school->id, 'name' => 'Sibling Discount'],
            ['discount_type' => 'percentage', 'default_value' => 10, 'status' => 'active'],
        );

        $students = [
            [
                'student_no' => 'MIS-2026-001',
                'full_name' => 'Alyssa Tan',
                'class_id' => $yearFour->id,
                'parent' => 'Michelle Tan',
                'phone' => '+60 12-100 0001',
                'discount' => true,
            ],
            [
                'student_no' => 'MIS-2026-002',
                'full_name' => 'Daniel Lim',
                'class_id' => $yearTwo->id,
                'parent' => 'Jonathan Lim',
                'phone' => '+60 12-100 0002',
                'discount' => false,
            ],
            [
                'student_no' => 'MIS-2026-003',
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

            if ($student->student_no === 'MIS-2026-001') {
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
    }
}
