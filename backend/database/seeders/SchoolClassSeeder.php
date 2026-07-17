<?php

namespace Database\Seeders;

use App\Models\School;
use App\Models\SchoolClass;
use App\Support\SchoolClassCatalog;
use Illuminate\Database\Seeder;

class SchoolClassSeeder extends Seeder
{
    public function run(): void
    {
        School::query()->each(function (School $school): void {
            foreach (SchoolClassCatalog::names() as $className) {
                SchoolClass::query()->updateOrCreate(
                    ['school_id' => $school->id, 'name' => $className],
                    ['status' => 'active'],
                );
            }

            foreach (SchoolClassCatalog::legacyNames() as $legacyName => $className) {
                $legacyClass = SchoolClass::query()
                    ->where('school_id', $school->id)
                    ->where('name', $legacyName)
                    ->first();

                if (! $legacyClass) {
                    continue;
                }

                $schoolClass = SchoolClass::query()
                    ->where('school_id', $school->id)
                    ->where('name', $className)
                    ->firstOrFail();

                $legacyClass->students()->update(['class_id' => $schoolClass->id]);
                $legacyClass->update(['status' => 'inactive']);
            }
        });
    }
}
