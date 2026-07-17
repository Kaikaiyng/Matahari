<?php

namespace App\Support;

final class SchoolClassCatalog
{
    /**
     * @return array<string, array<int, string>>
     */
    public static function groups(): array
    {
        return [
            'kindergarten' => ['Kindergarten'],
            'primary' => ['MA1', 'MB1', 'MC1', 'MD1', 'ME1', 'MF1'],
            'secondary' => ['MP1', 'MQ1', 'MR1', 'MS1', 'MT1'],
            'stp' => ['STP'],
        ];
    }

    public static function levelGroupFor(string $className): ?string
    {
        foreach (self::groups() as $levelGroup => $classNames) {
            if (in_array($className, $classNames, true)) {
                return $levelGroup;
            }
        }

        return null;
    }

    /**
     * @return array<int, string>
     */
    public static function names(): array
    {
        return array_merge(...array_values(self::groups()));
    }

    /**
     * @return array<string, string>
     */
    public static function legacyNames(): array
    {
        return [
            'Year 1' => 'MA1',
            'Year 2' => 'MB1',
            'Year 3' => 'MC1',
            'Year 4' => 'MD1',
            'Year 5' => 'ME1',
            'Year 6' => 'MF1',
            'Primary 1' => 'MA1',
            'Primary 2' => 'MB1',
            'Primary 3' => 'MC1',
            'Primary 4' => 'MD1',
            'Primary 5' => 'ME1',
            'Primary 6' => 'MF1',
            'Secondary 1' => 'MP1',
            'Secondary 2' => 'MQ1',
            'Secondary 3' => 'MR1',
            'Secondary 4' => 'MS1',
            'Secondary 5' => 'MT1',
            'Form 1' => 'MP1',
            'Form 2' => 'MQ1',
            'Form 3' => 'MR1',
            'Form 4' => 'MS1',
            'Form 5' => 'MT1',
        ];
    }
}
