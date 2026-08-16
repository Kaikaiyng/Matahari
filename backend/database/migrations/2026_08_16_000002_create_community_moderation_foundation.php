<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public $withinTransaction = false;

    private const POLICY_VERSION = '2026-08-16';

    public function up(): void
    {
        $this->preflightLegacyContent();
        Schema::withoutForeignKeyConstraints(fn () => $this->addContentOwnershipAndReviewColumns());
        $this->createPolicyTables();
        $this->createModerationTables();
        $this->seedInitialPolicies();
        $this->grantPlatformPermission();
    }

    public function down(): void
    {
        $permissionIds = DB::table('permissions')->where('slug', 'community.moderate_platform')->pluck('id');
        DB::table('role_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();

        Schema::dropIfExists('student_community_authorizations');
        Schema::dropIfExists('community_appeals');
        Schema::dropIfExists('community_user_restrictions');
        Schema::dropIfExists('community_user_blocks');
        Schema::dropIfExists('community_report_actions');
        Schema::dropIfExists('community_reports');
        Schema::dropIfExists('community_policy_acceptances');
        Schema::dropIfExists('community_policy_versions');

        Schema::withoutForeignKeyConstraints(function (): void {
            $this->dropContentOwnershipAndReviewColumns('community_comments', 'community_comments_tenant_school_fk');
            $this->dropContentOwnershipAndReviewColumns('community_posts', 'community_posts_tenant_school_fk');
        });
    }

    private function preflightLegacyContent(): void
    {
        foreach (['community_posts', 'community_comments'] as $table) {
            $id = DB::table("{$table} as content")
                ->leftJoin('schools as school', 'school.id', '=', 'content.school_id')
                ->where(fn ($query) => $query->whereNull('school.id')->orWhereNull('school.tenant_id'))
                ->orderBy('content.id')
                ->value('content.id');

            if ($id !== null) {
                throw new RuntimeException("UGC moderation migration blocked: {$table} row {$id} has no tenant-owned school.");
            }
        }
    }

    private function addContentOwnershipAndReviewColumns(): void
    {
        foreach (['community_posts', 'community_comments'] as $table) {
            if (! Schema::hasColumns($table, ['tenant_id', 'reviewed_at', 'reviewed_by_user_id', 'moderation_reason_code'])) {
                Schema::table($table, function (Blueprint $blueprint) use ($table): void {
                    if (! Schema::hasColumn($table, 'tenant_id')) {
                        $blueprint->unsignedBigInteger('tenant_id')->nullable();
                    }
                    if (! Schema::hasColumn($table, 'reviewed_at')) {
                        $blueprint->timestamp('reviewed_at')->nullable();
                    }
                    if (! Schema::hasColumn($table, 'reviewed_by_user_id')) {
                        $blueprint->foreignId('reviewed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                    }
                    if (! Schema::hasColumn($table, 'moderation_reason_code')) {
                        $blueprint->string('moderation_reason_code', 60)->nullable();
                    }
                });
            }

            DB::table($table)
                ->whereNull('tenant_id')
                ->update(['tenant_id' => DB::raw('(SELECT schools.tenant_id FROM schools WHERE schools.id = '.$table.'.school_id)')]);

            if ($this->columnIsNullable($table, 'tenant_id')) {
                Schema::table($table, function (Blueprint $blueprint): void {
                    $blueprint->unsignedBigInteger('tenant_id')->nullable(false)->change();
                });
            }
            Schema::table($table, function (Blueprint $blueprint) use ($table): void {
                if (! $this->hasForeignKey($table, ['tenant_id'])) {
                    $blueprint->foreign('tenant_id')->references('id')->on('tenants')->restrictOnDelete();
                }
                if (! $this->hasForeignKey($table, ['tenant_id', 'school_id'])) {
                    $blueprint->foreign(
                        ['tenant_id', 'school_id'],
                        DB::getDriverName() === 'sqlite' ? null : "{$table}_tenant_school_fk",
                    )->references(['tenant_id', 'id'])->on('schools')->restrictOnDelete();
                }
                if (! $this->hasIndex($table, "{$table}_tenant_queue_index")) {
                    $blueprint->index(['tenant_id', 'school_id', 'status', 'created_at'], "{$table}_tenant_queue_index");
                }
            });
        }
    }

    private function createPolicyTables(): void
    {
        if (! Schema::hasTable('community_policy_versions')) {
            Schema::create('community_policy_versions', function (Blueprint $table): void {
                $table->id();
                $table->string('policy_type', 40);
                $table->string('version', 30);
                $table->string('title');
                $table->string('public_path', 120);
                $table->json('sections');
                $table->timestamp('effective_at');
                $table->timestamp('retired_at')->nullable();
                $table->timestamps();
                $table->unique(['policy_type', 'version'], 'community_policy_type_version_unique');
                $table->index(['policy_type', 'effective_at', 'retired_at'], 'community_policy_effective_index');
            });
        }

        if (! Schema::hasTable('community_policy_acceptances')) {
            Schema::create('community_policy_acceptances', function (Blueprint $table): void {
                $table->id();
                $this->tenantSchool($table);
                $table->foreignId('user_id')->constrained()->restrictOnDelete();
                $table->foreignId('community_policy_version_id')->constrained('community_policy_versions')->restrictOnDelete();
                $table->timestamp('accepted_at');
                $table->json('security_context')->nullable();
                $table->timestamps();
                $table->unique(['tenant_id', 'school_id', 'user_id', 'community_policy_version_id'], 'community_policy_acceptance_unique');
                $table->index(['tenant_id', 'school_id', 'user_id', 'accepted_at'], 'community_policy_acceptance_lookup');
            });
        }
    }

    private function createModerationTables(): void
    {
        if (! Schema::hasTable('community_reports')) {
            Schema::create('community_reports', function (Blueprint $table): void {
                $table->id();
                $this->tenantSchool($table);
                $table->foreignId('reporter_user_id')->constrained('users')->restrictOnDelete();
                $table->string('target_type', 24);
                $table->foreignId('community_post_id')->nullable()->constrained('community_posts')->restrictOnDelete();
                $table->foreignId('community_comment_id')->nullable()->constrained('community_comments')->restrictOnDelete();
                $table->foreignId('reported_user_id')->constrained('users')->restrictOnDelete();
                $table->string('reason_code', 60);
                $table->text('details')->nullable();
                $table->string('priority', 24)->default('normal');
                $table->string('status', 24)->default('submitted');
                $table->json('target_snapshot');
                $table->timestamp('due_at');
                $table->foreignId('assigned_to_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('resolved_at')->nullable();
                $table->string('resolution_code', 60)->nullable();
                $table->timestamp('evidence_held_at')->nullable();
                $table->foreignId('evidence_held_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->index(['tenant_id', 'school_id', 'status', 'priority', 'due_at'], 'community_reports_tenant_queue_index');
                $table->index(['tenant_id', 'school_id', 'reporter_user_id', 'created_at'], 'community_reports_reporter_index');
                $table->index(['tenant_id', 'school_id', 'reported_user_id', 'status'], 'community_reports_subject_index');
            });
        }

        if (! Schema::hasTable('community_report_actions')) {
            Schema::create('community_report_actions', function (Blueprint $table): void {
                $table->id();
                $this->tenantSchool($table);
                $table->foreignId('community_report_id')->constrained('community_reports')->restrictOnDelete();
                $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('action', 60);
                $table->string('reason_code', 60)->nullable();
                $table->text('reason')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();
                $table->index(['tenant_id', 'school_id', 'community_report_id', 'created_at'], 'community_report_actions_case_index');
            });
        }

        if (! Schema::hasTable('community_user_blocks')) {
            Schema::create('community_user_blocks', function (Blueprint $table): void {
                $table->id();
                $this->tenantSchool($table);
                $table->foreignId('blocker_user_id')->constrained('users')->restrictOnDelete();
                $table->foreignId('blocked_user_id')->constrained('users')->restrictOnDelete();
                $table->timestamp('blocked_at');
                $table->timestamp('revoked_at')->nullable();
                $table->timestamps();
                $table->unique(['tenant_id', 'school_id', 'blocker_user_id', 'blocked_user_id'], 'community_user_block_unique');
                $table->index(['tenant_id', 'school_id', 'blocker_user_id', 'revoked_at'], 'community_user_blocks_active_index');
            });
        }

        if (! Schema::hasTable('community_user_restrictions')) {
            Schema::create('community_user_restrictions', function (Blueprint $table): void {
                $table->id();
                $this->tenantSchool($table);
                $table->foreignId('user_id')->constrained()->restrictOnDelete();
                $table->string('scope', 24);
                $table->string('reason_code', 60);
                $table->text('reason');
                $table->timestamp('starts_at');
                $table->timestamp('ends_at')->nullable();
                $table->foreignId('applied_by_user_id')->constrained('users')->restrictOnDelete();
                $table->timestamp('revoked_at')->nullable();
                $table->foreignId('revoked_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('status', 24)->default('active');
                $table->timestamps();
                $table->index(['tenant_id', 'school_id', 'user_id', 'status', 'ends_at'], 'community_user_restrictions_active_index');
            });
        }

        if (! Schema::hasTable('community_appeals')) {
            Schema::create('community_appeals', function (Blueprint $table): void {
                $table->id();
                $this->tenantSchool($table);
                $table->foreignId('community_report_id')->constrained('community_reports')->restrictOnDelete();
                $table->foreignId('source_action_id')->constrained('community_report_actions')->restrictOnDelete();
                $table->foreignId('appellant_user_id')->constrained('users')->restrictOnDelete();
                $table->text('statement');
                $table->string('status', 24)->default('submitted');
                $table->foreignId('reviewed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('decision', 24)->nullable();
                $table->text('decision_reason')->nullable();
                $table->timestamp('reviewed_at')->nullable();
                $table->timestamps();
                $table->unique(['tenant_id', 'school_id', 'community_report_id', 'appellant_user_id'], 'community_appeal_once_unique');
                $table->index(['tenant_id', 'school_id', 'status', 'created_at'], 'community_appeals_queue_index');
            });
        }

        if (! Schema::hasTable('student_community_authorizations')) {
            Schema::create('student_community_authorizations', function (Blueprint $table): void {
                $table->id();
                $this->tenantSchool($table);
                $table->foreignId('student_user_id')->constrained('users')->restrictOnDelete();
                $table->foreignId('authorized_by_user_id')->constrained('users')->restrictOnDelete();
                $table->string('capability', 40)->default('freeform_interaction');
                $table->timestamp('effective_at');
                $table->timestamp('revoked_at')->nullable();
                $table->foreignId('revoked_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->text('revocation_reason')->nullable();
                $table->timestamps();
                $table->unique(['tenant_id', 'school_id', 'student_user_id', 'capability'], 'student_community_authorization_unique');
                $table->index(['tenant_id', 'school_id', 'student_user_id', 'revoked_at'], 'student_community_authorization_active_index');
            });
        }
    }

    private function tenantSchool(Blueprint $table): void
    {
        $constraintNames = [
            'community_policy_acceptances' => 'cpa_tenant_school_fk',
            'community_reports' => 'cr_tenant_school_fk',
            'community_report_actions' => 'cra_tenant_school_fk',
            'community_user_blocks' => 'cub_tenant_school_fk',
            'community_user_restrictions' => 'cur_tenant_school_fk',
            'community_appeals' => 'ca_tenant_school_fk',
            'student_community_authorizations' => 'sca_tenant_school_fk',
        ];
        $table->foreignId('tenant_id')->constrained()->restrictOnDelete();
        $table->foreignId('school_id')->constrained()->restrictOnDelete();
        $table->foreign(['tenant_id', 'school_id'], $constraintNames[$table->getTable()])
            ->references(['tenant_id', 'id'])->on('schools')->restrictOnDelete();
    }

    private function seedInitialPolicies(): void
    {
        $now = now();
        $policies = [
            'terms' => ['Terms of Use', '/legal/terms', [
                ['heading' => 'Account use', 'body' => 'Use RYLAY only through an account and school access you are authorized to use.'],
                ['heading' => 'Community conduct', 'body' => 'Community contributions must follow the current Community Standards and may be reviewed, restricted, or preserved for safety.'],
            ]],
            'privacy' => ['Privacy Notice', '/legal/privacy', [
                ['heading' => 'Community data', 'body' => 'RYLAY processes account identity, school scope, contributions, reports, moderation actions, and security context to operate and protect the service.'],
                ['heading' => 'Evidence retention', 'body' => 'Reported content snapshots and quarantined media may be retained for safety, appeals, audit, and lawful reporting obligations.'],
            ]],
            'community_standards' => ['Community Standards', '/legal/community-standards', [
                ['heading' => 'Prohibited content', 'body' => 'Do not post child sexual abuse or exploitation material, sexual content involving minors, bullying, harassment, credible threats, hate, self-harm encouragement, privacy exposure, impersonation, or spam.'],
                ['heading' => 'Safety controls', 'body' => 'Users can separately report content, report users, and block users. School moderators review cases and RYLAY may intervene in severe escalations.'],
            ]],
            'child_safety' => ['Child Safety Standards', '/legal/child-safety', [
                ['heading' => 'Zero tolerance', 'body' => 'RYLAY prohibits child sexual abuse and exploitation, grooming, sextortion, trafficking, and any sexualization of children.'],
                ['heading' => 'Response', 'body' => 'Severe reports are quarantined for urgent review. Confirmed CSAM must be preserved and reported through the applicable lawful process by authorized personnel.'],
            ]],
        ];

        foreach ($policies as $type => [$title, $path, $sections]) {
            DB::table('community_policy_versions')->updateOrInsert(
                ['policy_type' => $type, 'version' => self::POLICY_VERSION],
                [
                    'title' => $title,
                    'public_path' => $path,
                    'sections' => json_encode($sections, JSON_THROW_ON_ERROR),
                    'effective_at' => $now,
                    'retired_at' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            );
        }
    }

    private function grantPlatformPermission(): void
    {
        $now = now();
        DB::table('permissions')->updateOrInsert(
            ['slug' => 'community.moderate_platform'],
            ['name' => 'Moderate severe Community cases across the platform', 'created_at' => $now, 'updated_at' => $now],
        );
        $permissionId = DB::table('permissions')->where('slug', 'community.moderate_platform')->value('id');
        foreach (DB::table('roles')->where('slug', 'super-admin')->pluck('id') as $roleId) {
            DB::table('role_permissions')->updateOrInsert(
                ['role_id' => $roleId, 'permission_id' => $permissionId],
                ['created_at' => $now, 'updated_at' => $now],
            );
        }
    }

    private function dropContentOwnershipAndReviewColumns(string $table, string $compositeForeign): void
    {
        Schema::table($table, function (Blueprint $blueprint) use ($table, $compositeForeign): void {
            $blueprint->dropIndex("{$table}_tenant_queue_index");
            $blueprint->dropForeign(DB::getDriverName() === 'sqlite' ? ['tenant_id', 'school_id'] : $compositeForeign);
            $blueprint->dropForeign(['tenant_id']);
            $blueprint->dropForeign(['reviewed_by_user_id']);
            $blueprint->dropColumn(['tenant_id', 'reviewed_at', 'reviewed_by_user_id', 'moderation_reason_code']);
        });
    }

    private function columnIsNullable(string $table, string $column): bool
    {
        $definition = collect(Schema::getColumns($table))->firstWhere('name', $column);

        return (bool) ($definition['nullable'] ?? false);
    }

    /** @param list<string> $columns */
    private function hasForeignKey(string $table, array $columns): bool
    {
        return collect(Schema::getForeignKeys($table))
            ->contains(fn (array $foreignKey): bool => array_values($foreignKey['columns']) === $columns);
    }

    private function hasIndex(string $table, string $name): bool
    {
        return collect(Schema::getIndexes($table))
            ->contains(fn (array $index): bool => $index['name'] === $name);
    }
};
