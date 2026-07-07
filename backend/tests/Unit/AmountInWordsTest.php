<?php

namespace Tests\Unit;

use App\Services\Billing\AmountInWords;
use PHPUnit\Framework\TestCase;

class AmountInWordsTest extends TestCase
{
    public function test_formats_whole_ringgit_amounts(): void
    {
        $this->assertSame('One Ringgit Only', AmountInWords::ringgit(1));
        $this->assertSame('One Hundred Five Ringgit Only', AmountInWords::ringgit(105));
        $this->assertSame('One Thousand Two Hundred Fifty Ringgit Only', AmountInWords::ringgit(1250));
    }

    public function test_formats_ringgit_and_sen_amounts(): void
    {
        $this->assertSame(
            'One Thousand Two Hundred Fifty Ringgit and Fifty Sen Only',
            AmountInWords::ringgit(1250.50),
        );
        $this->assertSame('Zero Ringgit and Five Sen Only', AmountInWords::ringgit(0.05));
    }
}
