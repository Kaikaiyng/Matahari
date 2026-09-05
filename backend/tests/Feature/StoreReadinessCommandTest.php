<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StoreReadinessCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_command_fails_when_public_safety_configuration_is_missing(): void
    {
        config()->set('community_safety.public_urls', array_fill_keys(['terms', 'privacy', 'community_standards', 'child_safety', 'support', 'account_deletion'], null));
        config()->set('community_safety.support_email');
        config()->set('community_safety.child_safety_contact_email');

        $this->artisan('app:store-readiness')
            ->expectsOutputToContain('CHILD_SAFETY_CONTACT_EMAIL is missing')
            ->assertFailed();
    }

    public function test_command_passes_only_with_explicit_urls_contacts_and_effective_policies(): void
    {
        $this->seed();
        config()->set('app.name', 'RYLAY');
        config()->set('community_safety.public_urls', [
            'terms' => 'https://app.rylay.my/legal/terms', 'privacy' => 'https://app.rylay.my/legal/privacy',
            'community_standards' => 'https://app.rylay.my/legal/community-standards', 'child_safety' => 'https://app.rylay.my/legal/child-safety',
            'support' => 'https://app.rylay.my/legal/support', 'account_deletion' => 'https://app.rylay.my/legal/account-deletion',
        ]);
        config()->set('community_safety.support_email', 'support@rylay.my');
        config()->set('community_safety.child_safety_contact_email', 'safety@rylay.my');

        $this->artisan('app:store-readiness')->expectsOutputToContain('Store readiness checks passed.')->assertSuccessful();
    }

    public function test_command_rejects_example_and_placeholder_store_values(): void
    {
        $this->seed();
        config()->set('community_safety.public_urls', [
            'terms' => 'https://app.example.com/legal/terms', 'privacy' => 'https://app.example.com/legal/privacy',
            'community_standards' => 'https://placeholder.invalid/legal/community-standards', 'child_safety' => 'https://app.example.com/legal/child-safety',
            'support' => 'https://app.example.com/legal/support', 'account_deletion' => 'https://app.example.com/legal/account-deletion',
        ]);
        config()->set('community_safety.support_email', 'support@example.com');
        config()->set('community_safety.child_safety_contact_email', 'safety@example.com');
        config()->set('community_safety.developer_name', 'Placeholder Developer');

        $this->artisan('app:store-readiness')
            ->expectsOutputToContain('TERMS public URL uses an example or placeholder value')
            ->expectsOutputToContain('COMMUNITY_STANDARDS public URL uses an example or placeholder value')
            ->expectsOutputToContain('COMMUNITY_SUPPORT_EMAIL uses an example or placeholder value')
            ->expectsOutputToContain('CHILD_SAFETY_CONTACT_EMAIL uses an example or placeholder value')
            ->expectsOutputToContain('COMMUNITY_DEVELOPER_NAME uses a placeholder value')
            ->assertFailed();
    }
}
