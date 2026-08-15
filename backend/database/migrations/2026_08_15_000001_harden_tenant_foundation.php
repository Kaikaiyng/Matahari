<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public $withinTransaction = false;

    public function up(): void
    {
        $this->runPreflight();

        Schema::withoutForeignKeyConstraints(function (): void {
            $this->applyHardeningConstraints();
        });
    }

    private function applyHardeningConstraints(): void
    {

        if ($this->hasIndex('schools', 'schools_code_unique')) {
            Schema::table('schools', function (Blueprint $table): void {
                $table->dropUnique('schools_code_unique');
            });
        }

        if (! Schema::hasColumn('tenant_membership_schools', 'tenant_id')) {
            Schema::table('tenant_membership_schools', function (Blueprint $table): void {
                $table->foreignId('tenant_id')->nullable()->after('id');
            });

            DB::table('tenant_membership_schools')->orderBy('id')->each(function (object $pivot): void {
                $tenantId = DB::table('tenant_user_memberships')
                    ->where('id', $pivot->tenant_user_membership_id)
                    ->value('tenant_id');

                DB::table('tenant_membership_schools')
                    ->where('id', $pivot->id)
                    ->update(['tenant_id' => $tenantId]);
            });

        }

        $pivotId = DB::table('tenant_membership_schools')->whereNull('tenant_id')->orderBy('id')->value('id');
        if ($pivotId !== null) {
            throw new RuntimeException("Tenant hardening blocked: membership school {$pivotId} has no tenant_id.");
        }

        Schema::table('schools', function (Blueprint $table): void {
            $table->unsignedBigInteger('tenant_id')->nullable(false)->change();
        });
        Schema::table('tenant_membership_schools', function (Blueprint $table): void {
            $table->unsignedBigInteger('tenant_id')->nullable(false)->change();
        });

        Schema::table('schools', function (Blueprint $table): void {
            if (! $this->hasIndex('schools', 'schools_tenant_code_unique')) {
                $table->unique(['tenant_id', 'code'], 'schools_tenant_code_unique');
            }
            if (! $this->hasIndex('schools', 'schools_tenant_id_id_unique')) {
                $table->unique(['tenant_id', 'id'], 'schools_tenant_id_id_unique');
            }
        });

        $this->removeOrphanedForeignKeyIndex(
            'tenant_user_memberships',
            'tum_default_school_tenant_fk',
            ['tenant_id', 'default_school_id'],
        );
        $this->removeOrphanedForeignKeyIndex(
            'tenant_membership_schools',
            'tms_membership_tenant_fk',
            ['tenant_id', 'tenant_user_membership_id'],
        );
        $this->removeOrphanedForeignKeyIndex(
            'tenant_membership_schools',
            'tms_school_tenant_fk',
            ['tenant_id', 'school_id'],
        );

        Schema::table('tenant_user_memberships', function (Blueprint $table): void {
            if (! $this->hasIndex('tenant_user_memberships', 'tenant_memberships_tenant_id_id_unique')) {
                $table->unique(['tenant_id', 'id'], 'tenant_memberships_tenant_id_id_unique');
            }
            if (! $this->hasForeignKey('tenant_user_memberships', ['tenant_id', 'default_school_id'])) {
                $table->foreign(
                    ['tenant_id', 'default_school_id'],
                    DB::getDriverName() === 'sqlite' ? null : 'tum_default_school_tenant_fk',
                )
                    ->references(['tenant_id', 'id'])->on('schools')->restrictOnDelete();
            }
        });
        Schema::table('tenant_membership_schools', function (Blueprint $table): void {
            if (! $this->hasForeignKey('tenant_membership_schools', ['tenant_id', 'tenant_user_membership_id'])) {
                $table->foreign(
                    ['tenant_id', 'tenant_user_membership_id'],
                    DB::getDriverName() === 'sqlite' ? null : 'tms_membership_tenant_fk',
                )
                    ->references(['tenant_id', 'id'])->on('tenant_user_memberships')->cascadeOnDelete();
            }
            if (! $this->hasForeignKey('tenant_membership_schools', ['tenant_id', 'school_id'])) {
                $table->foreign(
                    ['tenant_id', 'school_id'],
                    DB::getDriverName() === 'sqlite' ? null : 'tms_school_tenant_fk',
                )
                    ->references(['tenant_id', 'id'])->on('schools')->cascadeOnDelete();
            }
        });

        $this->addPrimarySurfaceGuard();
    }

    public function down(): void
    {
        Schema::withoutForeignKeyConstraints(function (): void {
            $this->removeHardeningConstraints();
        });
    }

    private function removeHardeningConstraints(): void
    {
        if ($this->hasIndex('tenant_domains', 'tenant_domains_one_primary_surface_unique')) {
            Schema::table('tenant_domains', function (Blueprint $table): void {
                $table->dropUnique('tenant_domains_one_primary_surface_unique');
            });
        }
        if (Schema::hasColumn('tenant_domains', 'primary_surface')) {
            Schema::table('tenant_domains', function (Blueprint $table): void {
                $table->dropColumn('primary_surface');
            });
        }

        Schema::table('tenant_membership_schools', function (Blueprint $table): void {
            if ($this->hasForeignKey('tenant_membership_schools', ['tenant_id', 'tenant_user_membership_id'])) {
                $table->dropForeign(DB::getDriverName() === 'sqlite'
                    ? ['tenant_id', 'tenant_user_membership_id']
                    : 'tms_membership_tenant_fk');
            }
            if ($this->hasForeignKey('tenant_membership_schools', ['tenant_id', 'school_id'])) {
                $table->dropForeign(DB::getDriverName() === 'sqlite'
                    ? ['tenant_id', 'school_id']
                    : 'tms_school_tenant_fk');
            }
        });
        Schema::table('tenant_user_memberships', function (Blueprint $table): void {
            if ($this->hasForeignKey('tenant_user_memberships', ['tenant_id', 'default_school_id'])) {
                $table->dropForeign(DB::getDriverName() === 'sqlite'
                    ? ['tenant_id', 'default_school_id']
                    : 'tum_default_school_tenant_fk');
            }
            if ($this->hasIndex('tenant_user_memberships', 'tenant_memberships_tenant_id_id_unique')) {
                $table->dropUnique('tenant_memberships_tenant_id_id_unique');
            }
        });
        Schema::table('schools', function (Blueprint $table): void {
            if ($this->hasIndex('schools', 'schools_tenant_id_id_unique')) {
                $table->dropUnique('schools_tenant_id_id_unique');
            }
        });

        Schema::table('schools', function (Blueprint $table): void {
            $table->unsignedBigInteger('tenant_id')->nullable()->change();
        });

        if (Schema::hasColumn('tenant_membership_schools', 'tenant_id')) {
            Schema::table('tenant_membership_schools', function (Blueprint $table): void {
                $table->dropColumn('tenant_id');
            });
        }
    }

    private function runPreflight(): void
    {
        $schoolId = DB::table('schools')->whereNull('tenant_id')->orderBy('id')->value('id');
        if ($schoolId !== null) {
            throw new RuntimeException("Tenant hardening blocked: school {$schoolId} has no tenant_id.");
        }

        $duplicateSchool = DB::table('schools')
            ->select('tenant_id', 'code')
            ->groupBy('tenant_id', 'code')
            ->havingRaw('COUNT(*) > 1')
            ->orderBy('tenant_id')
            ->first();
        if ($duplicateSchool) {
            throw new RuntimeException("Tenant hardening blocked: tenant {$duplicateSchool->tenant_id} has duplicate school code {$duplicateSchool->code}.");
        }

        $defaultMismatch = DB::table('tenant_user_memberships as membership')
            ->leftJoin('schools as school', 'school.id', '=', 'membership.default_school_id')
            ->whereNotNull('membership.default_school_id')
            ->where(function ($query): void {
                $query->whereNull('school.id')->orWhereColumn('school.tenant_id', '!=', 'membership.tenant_id');
            })
            ->orderBy('membership.id')
            ->value('membership.id');
        if ($defaultMismatch !== null) {
            throw new RuntimeException("Tenant hardening blocked: membership {$defaultMismatch} has a default school in another tenant.");
        }

        $schoolMismatch = DB::table('tenant_membership_schools as pivot')
            ->join('tenant_user_memberships as membership', 'membership.id', '=', 'pivot.tenant_user_membership_id')
            ->join('schools as school', 'school.id', '=', 'pivot.school_id')
            ->whereColumn('school.tenant_id', '!=', 'membership.tenant_id')
            ->orderBy('pivot.id')
            ->value('pivot.id');
        if ($schoolMismatch !== null) {
            throw new RuntimeException("Tenant hardening blocked: membership school {$schoolMismatch} crosses tenants.");
        }

        $invalidDomain = DB::table('tenant_domains')
            ->whereNotIn('surface', ['admin', 'app', 'api'])
            ->orderBy('id')
            ->value('id');
        if ($invalidDomain !== null) {
            throw new RuntimeException("Tenant hardening blocked: domain {$invalidDomain} has an unsupported surface.");
        }

        $duplicatePrimary = DB::table('tenant_domains')
            ->select('tenant_id', 'surface')
            ->where('is_primary', true)
            ->groupBy('tenant_id', 'surface')
            ->havingRaw('COUNT(*) > 1')
            ->orderBy('tenant_id')
            ->first();
        if ($duplicatePrimary) {
            throw new RuntimeException("Tenant hardening blocked: tenant {$duplicatePrimary->tenant_id} has multiple primary {$duplicatePrimary->surface} domains.");
        }
    }

    private function addPrimarySurfaceGuard(): void
    {
        $driver = DB::getDriverName();
        if (! Schema::hasColumn('tenant_domains', 'primary_surface')) {
            if ($driver === 'sqlite') {
                DB::statement('ALTER TABLE tenant_domains ADD COLUMN primary_surface TEXT GENERATED ALWAYS AS (CASE WHEN is_primary = 1 THEN surface ELSE NULL END) VIRTUAL');
            } elseif (in_array($driver, ['mariadb', 'mysql'], true)) {
                DB::statement('ALTER TABLE tenant_domains ADD COLUMN primary_surface VARCHAR(20) GENERATED ALWAYS AS (CASE WHEN is_primary = 1 THEN surface ELSE NULL END) STORED');
            } else {
                throw new RuntimeException("Tenant hardening does not support the {$driver} database driver.");
            }
        }

        Schema::table('tenant_domains', function (Blueprint $table): void {
            if (! $this->hasIndex('tenant_domains', 'tenant_domains_one_primary_surface_unique')) {
                $table->unique(['tenant_id', 'primary_surface'], 'tenant_domains_one_primary_surface_unique');
            }
        });
    }

    private function hasIndex(string $table, string $name): bool
    {
        return collect(Schema::getIndexes($table))
            ->contains(fn (array $index): bool => $index['name'] === $name);
    }

    /** @param list<string> $columns */
    private function hasForeignKey(string $table, array $columns): bool
    {
        return collect(Schema::getForeignKeys($table))
            ->contains(fn (array $foreignKey): bool => array_values($foreignKey['columns']) === $columns);
    }

    /** @param list<string> $columns */
    private function removeOrphanedForeignKeyIndex(string $table, string $name, array $columns): void
    {
        if (DB::getDriverName() === 'sqlite' || $this->hasForeignKey($table, $columns) || ! $this->hasIndex($table, $name)) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($name): void {
            $blueprint->dropIndex($name);
        });
    }
};
