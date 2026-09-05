<?php

namespace App\Console\Commands;

use App\Models\School;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Authorization\UserPermissionResolver;
use App\Services\Students\StudentCsvImportService;
use App\Support\SchoolScopeResolver;
use App\Support\TenantContext;
use Illuminate\Console\Command;
use Throwable;

class ImportStudentsFromCsv extends Command
{
    protected $signature = 'students:import-csv
        {--tenant= : Active tenant slug}
        {--school= : Active school code within the tenant}
        {--actor= : Active actor username used for authorization and audit}
        {--file= : CSV file path}
        {--commit : Persist the import; without this flag the command only validates}';

    protected $description = 'Validate or import new students from a UTF-8 CSV file';

    public function handle(
        StudentCsvImportService $imports,
        SchoolScopeResolver $schoolScopes,
        UserPermissionResolver $permissions,
    ): int {
        $options = [];
        $missing = false;
        foreach (['tenant', 'school', 'actor', 'file'] as $name) {
            $value = trim((string) $this->option($name));
            $options[$name] = $value;
            if ($value === '') {
                $this->error("The --{$name} option is required.");
                $missing = true;
            }
        }
        if ($missing) {
            return self::FAILURE;
        }

        $mode = config('tenancy.mode');
        $dedicatedTenantSlug = trim((string) config('tenancy.dedicated_tenant_slug'));
        if (! in_array($mode, ['dedicated', 'multi_tenant'], true)
            || ($mode === 'dedicated' && $dedicatedTenantSlug === '')) {
            $this->error('Valid tenancy mode and dedicated tenant configuration are required.');

            return self::FAILURE;
        }
        if ($mode === 'dedicated' && $options['tenant'] !== $dedicatedTenantSlug) {
            $this->error("Tenant [{$options['tenant']}] does not match the configured dedicated tenant [{$dedicatedTenantSlug}].");

            return self::FAILURE;
        }

        $tenant = Tenant::query()
            ->where('slug', $options['tenant'])
            ->where('status', 'active')
            ->first();
        if (! $tenant) {
            $this->error("Active tenant [{$options['tenant']}] was not found.");

            return self::FAILURE;
        }

        $school = School::query()
            ->where('tenant_id', $tenant->id)
            ->where('code', $options['school'])
            ->where('status', 'active')
            ->first();
        if (! $school) {
            $this->error("Active school [{$options['school']}] was not found in tenant [{$tenant->slug}].");

            return self::FAILURE;
        }

        $actor = User::query()
            ->where('username', $options['actor'])
            ->where('status', 'active')
            ->first();
        if (! $actor) {
            $this->error("Active actor [{$options['actor']}] was not found.");

            return self::FAILURE;
        }

        app()->instance(TenantContext::class, new TenantContext($tenant));
        try {
            try {
                $schoolScopes->resolve($actor, $school->id);
            } catch (Throwable) {
                $this->error("Actor [{$actor->username}] is not allowed to access school [{$school->code}] in tenant [{$tenant->slug}].");

                return self::FAILURE;
            }
            if (! $permissions->has($actor, 'students.create', $school->id)) {
                $this->error("Actor [{$actor->username}] does not have [students.create] for school [{$school->code}].");

                return self::FAILURE;
            }
        } finally {
            app()->forgetInstance(TenantContext::class);
        }

        try {
            $preflight = $imports->preflight($school, $options['file']);
        } catch (Throwable) {
            $this->error('Unable to validate the CSV. Check that it is a readable local file and the database is available.');

            return self::FAILURE;
        }

        if ($preflight['errors'] !== []) {
            foreach ($preflight['errors'] as $line => $errors) {
                $this->error("Row {$line}: ".implode(' ', array_values(array_unique($errors))));
            }
            $this->error(sprintf(
                'Preflight failed: %d row(s) contain errors; no data was written.',
                count($preflight['errors']),
            ));

            return self::FAILURE;
        }

        if (! $this->option('commit')) {
            $this->info(sprintf(
                'Dry run passed: %d student row(s) validated; no data was written.',
                count($preflight['rows']),
            ));

            return self::SUCCESS;
        }

        try {
            $created = $imports->commit($tenant, $school, $actor, $preflight['rows']);
        } catch (Throwable) {
            $this->error('Import failed; the transaction was rolled back. Check database availability, duplicate student numbers and audit persistence.');

            return self::FAILURE;
        }

        $this->info("Imported {$created} student(s) into tenant [{$tenant->slug}], school [{$school->code}].");

        return self::SUCCESS;
    }
}
