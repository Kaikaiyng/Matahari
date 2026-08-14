<?php

namespace App\Support;

use App\Models\Tenant;
use App\Models\TenantDomain;
use Illuminate\Http\Request;
use LogicException;

final readonly class TenantContext
{
    public const ATTRIBUTE = 'tenant_context';

    public function __construct(public Tenant $tenant, public ?TenantDomain $domain = null) {}

    public function tenantId(): int
    {
        return (int) $this->tenant->id;
    }

    public function surface(): ?string
    {
        return $this->domain?->surface;
    }

    public static function fromRequest(Request $request): self
    {
        $context = $request->attributes->get(self::ATTRIBUTE);
        if (! $context instanceof self) {
            throw new LogicException('Tenant context middleware did not resolve a tenant.');
        }

        return $context;
    }

    public static function optional(Request $request): ?self
    {
        $context = $request->attributes->get(self::ATTRIBUTE);

        return $context instanceof self ? $context : null;
    }
}
