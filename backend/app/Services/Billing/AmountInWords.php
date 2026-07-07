<?php

namespace App\Services\Billing;

class AmountInWords
{
    /**
     * @var array<int, string>
     */
    private const BELOW_TWENTY = [
        0 => 'Zero',
        1 => 'One',
        2 => 'Two',
        3 => 'Three',
        4 => 'Four',
        5 => 'Five',
        6 => 'Six',
        7 => 'Seven',
        8 => 'Eight',
        9 => 'Nine',
        10 => 'Ten',
        11 => 'Eleven',
        12 => 'Twelve',
        13 => 'Thirteen',
        14 => 'Fourteen',
        15 => 'Fifteen',
        16 => 'Sixteen',
        17 => 'Seventeen',
        18 => 'Eighteen',
        19 => 'Nineteen',
    ];

    /**
     * @var array<int, string>
     */
    private const TENS = [
        20 => 'Twenty',
        30 => 'Thirty',
        40 => 'Forty',
        50 => 'Fifty',
        60 => 'Sixty',
        70 => 'Seventy',
        80 => 'Eighty',
        90 => 'Ninety',
    ];

    public static function ringgit(float|int|string $amount): string
    {
        $cents = (int) round(((float) $amount) * 100);
        $ringgit = intdiv($cents, 100);
        $sen = $cents % 100;

        $words = self::number($ringgit).' Ringgit';

        if ($sen > 0) {
            $words .= ' and '.self::number($sen).' Sen';
        }

        return $words.' Only';
    }

    private static function number(int $number): string
    {
        if ($number < 20) {
            return self::BELOW_TWENTY[$number];
        }

        if ($number < 100) {
            $tens = intdiv($number, 10) * 10;
            $remainder = $number % 10;

            return trim(self::TENS[$tens].' '.($remainder > 0 ? self::number($remainder) : ''));
        }

        if ($number < 1000) {
            $hundreds = intdiv($number, 100);
            $remainder = $number % 100;

            return trim(self::number($hundreds).' Hundred '.($remainder > 0 ? self::number($remainder) : ''));
        }

        if ($number < 1000000) {
            $thousands = intdiv($number, 1000);
            $remainder = $number % 1000;

            return trim(self::number($thousands).' Thousand '.($remainder > 0 ? self::number($remainder) : ''));
        }

        $millions = intdiv($number, 1000000);
        $remainder = $number % 1000000;

        return trim(self::number($millions).' Million '.($remainder > 0 ? self::number($remainder) : ''));
    }
}
