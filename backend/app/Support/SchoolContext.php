<?php

namespace App\Support;

use Illuminate\Http\Request;
use LogicException;

final readonly class SchoolContext
{
    public const ATTRIBUTE = 'school_context';

    public function __construct(public int $schoolId) {}

    public static function fromRequest(Request $request): self
    {
        $context = $request->attributes->get(self::ATTRIBUTE);

        if (! $context instanceof self) {
            throw new LogicException('School context middleware did not run.');
        }

        return $context;
    }
}
