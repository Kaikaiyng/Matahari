<?php

namespace Tests\Unit;

use App\Services\Community\CommunitySafetyFilter;
use Tests\TestCase;

class CommunitySafetyFilterTest extends TestCase
{
    public function test_it_normalizes_invisible_and_compatibility_characters_before_matching(): void
    {
        $filter = app(CommunitySafetyFilter::class);

        $zeroWidth = $filter->inspect("b\u{200B}ully");
        $fullWidth = $filter->inspect('ｂｕｌｌｙ');

        $this->assertFalse($zeroWidth->allowed);
        $this->assertSame('bullying_harassment', $zeroWidth->reasonCode);
        $this->assertFalse($fullWidth->allowed);
        $this->assertSame('bullying_harassment', $fullWidth->reasonCode);
    }

    public function test_severe_child_safety_language_is_rejected(): void
    {
        $inspection = app(CommunitySafetyFilter::class)->inspect('Instructions for grooming a child');

        $this->assertFalse($inspection->allowed);
        $this->assertSame('child_safety', $inspection->reasonCode);
        $this->assertTrue($inspection->requiresManualReview);
    }

    public function test_links_and_direct_contact_details_are_sent_to_manual_review(): void
    {
        $filter = app(CommunitySafetyFilter::class);

        foreach (['Visit https://example.test', 'Email me at person@example.test', 'Call +60 12-345 6789'] as $text) {
            $inspection = $filter->inspect($text);
            $this->assertTrue($inspection->allowed);
            $this->assertSame('privacy_exposure', $inspection->reasonCode);
            $this->assertTrue($inspection->requiresManualReview);
        }
    }

    public function test_safe_text_is_normalized_without_being_rejected(): void
    {
        $inspection = app(CommunitySafetyFilter::class)->inspect("  Class   starts\r\n tomorrow.  ");

        $this->assertTrue($inspection->allowed);
        $this->assertNull($inspection->reasonCode);
        $this->assertFalse($inspection->requiresManualReview);
        $this->assertSame("Class starts\n tomorrow.", $inspection->normalized);
    }
}
