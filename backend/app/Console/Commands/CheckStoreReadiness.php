<?php

namespace App\Console\Commands;

use App\Models\CommunityPolicyVersion;
use Illuminate\Console\Command;

class CheckStoreReadiness extends Command
{
    protected $signature = 'app:store-readiness';

    protected $description = 'Fail unless public Community safety and store-review configuration is complete';

    public function handle(): int
    {
        $failures = [];
        foreach (['terms', 'privacy', 'community_standards', 'child_safety', 'support', 'account_deletion'] as $name) {
            $url = config("community_safety.public_urls.{$name}");
            if (! is_string($url) || filter_var($url, FILTER_VALIDATE_URL) === false || parse_url($url, PHP_URL_SCHEME) !== 'https') {
                $failures[] = strtoupper((string) $name).' public URL is missing or is not HTTPS';
            }
        }
        if (! $this->validEmail(config('community_safety.support_email'))) {
            $failures[] = 'COMMUNITY_SUPPORT_EMAIL is missing or invalid';
        }
        if (! $this->validEmail(config('community_safety.child_safety_contact_email'))) {
            $failures[] = 'CHILD_SAFETY_CONTACT_EMAIL is missing or invalid';
        }
        if (trim((string) config('community_safety.developer_name')) === '') {
            $failures[] = 'COMMUNITY_DEVELOPER_NAME is missing';
        }
        foreach (['terms', 'privacy', 'community_standards', 'child_safety'] as $type) {
            $exists = CommunityPolicyVersion::query()->where('policy_type', $type)->where('effective_at', '<=', now())
                ->where(fn ($query) => $query->whereNull('retired_at')->orWhere('retired_at', '>', now()))->exists();
            if (! $exists) {
                $failures[] = "Effective {$type} policy is missing";
            }
        }

        if ($failures !== []) {
            foreach ($failures as $failure) {
                $this->error($failure);
            }

            return self::FAILURE;
        }

        $this->info('Store readiness checks passed.');

        return self::SUCCESS;
    }

    private function validEmail(mixed $value): bool
    {
        return is_string($value) && filter_var($value, FILTER_VALIDATE_EMAIL) !== false;
    }
}
