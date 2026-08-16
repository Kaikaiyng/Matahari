<?php

namespace App\Services\Community;

use Normalizer;

class CommunitySafetyFilter
{
    public function inspect(string $text): SafetyInspection
    {
        $normalized = $this->normalize($text);
        $matchingText = mb_strtolower($normalized, 'UTF-8');

        foreach ((array) config('community_safety.blocked_patterns', []) as $reasonCode => $patterns) {
            foreach ($patterns as $pattern) {
                if (preg_match($pattern, $matchingText) === 1) {
                    return new SafetyInspection($normalized, false, (string) $reasonCode, true);
                }
            }
        }

        foreach ((array) config('community_safety.contact_patterns', []) as $pattern) {
            if (preg_match($pattern, $normalized) === 1) {
                return new SafetyInspection($normalized, true, 'privacy_exposure', true);
            }
        }

        return new SafetyInspection($normalized, true, null, false);
    }

    private function normalize(string $text): string
    {
        if (class_exists(Normalizer::class)) {
            $text = Normalizer::normalize($text, Normalizer::FORM_KC) ?: $text;
        }

        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = preg_replace('/[\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2060}-\x{206F}\x{FEFF}]/u', '', $text) ?? $text;
        $text = preg_replace('/[^\P{C}\n\t]+/u', '', $text) ?? $text;
        $text = preg_replace('/[^\S\n]+/u', ' ', $text) ?? $text;

        return trim($text);
    }
}
