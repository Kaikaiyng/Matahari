<?php

return [
    'developer_name' => env('COMMUNITY_DEVELOPER_NAME', 'RYLAY'),
    'required_acceptance_policy_types' => ['terms', 'community_standards'],
    'reason_codes' => [
        'child_safety', 'sexual_content', 'bullying_harassment', 'threats_violence',
        'self_harm', 'hate', 'privacy_exposure', 'impersonation', 'spam', 'other',
    ],
    'severe_reason_codes' => ['child_safety', 'sexual_content', 'threats_violence'],
    'sla_hours' => ['severe' => 4, 'normal' => 24],
    'maximum_reports_per_hour' => 10,
    'blocked_patterns' => [
        'child_safety' => [
            '/\b(?:groom(?:ing|ed)?\s+(?:a\s+)?child|child\s+sexual\s+abuse|csam|sextortion)\b/iu',
        ],
        'sexual_content' => [
            '/\b(?:sexual\s+content\s+involving\s+(?:a\s+)?minor|sexualize\s+(?:a\s+)?child)\b/iu',
        ],
        'bullying_harassment' => [
            '/\bb[\W_]*u[\W_]*l[\W_]*l[\W_]*y(?:ing|ied)?\b/iu',
            '/\b(?:harass|humiliate)(?:ment|ing|ed)?\b/iu',
        ],
        'threats_violence' => [
            '/\b(?:credible\s+threat|threaten(?:ing|ed)?\s+violence)\b/iu',
        ],
        'self_harm' => [
            '/\b(?:encourage(?:s|d|ment)?\s+self[- ]?harm|self[- ]?harm\s+instructions)\b/iu',
        ],
        'hate' => [
            '/\b(?:hate\s+speech|racial\s+slur)\b/iu',
        ],
        'impersonation' => [
            '/\bimpersonat(?:e|es|ed|ing)\s+(?:a\s+)?(?:teacher|student|parent|staff)\b/iu',
        ],
        'spam' => [
            '/\b(?:guaranteed\s+money|click\s+every\s+link)\b/iu',
        ],
    ],
    'contact_patterns' => [
        '/\bhttps?:\/\/[^\s]+/iu',
        '/\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b/iu',
        '/(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)/u',
        '/\b(?:whatsapp|wa\.me|telegram|t\.me|wechat|weixin|ig|instagram|tiktok|snapchat|discord|line|viber)[:\s@]+[a-z0-9_.-]+/iu',
        '/\b(?:add|pm|dm|follow|text)\s+me\s+(?:on|at)\s+[a-z0-9_.-]+/iu',
    ],
    'public_urls' => [
        'terms' => env('COMMUNITY_TERMS_URL'),
        'privacy' => env('COMMUNITY_PRIVACY_URL'),
        'community_standards' => env('COMMUNITY_STANDARDS_URL'),
        'child_safety' => env('COMMUNITY_CHILD_SAFETY_URL'),
        'support' => env('COMMUNITY_SUPPORT_URL'),
        'account_deletion' => env('COMMUNITY_ACCOUNT_DELETION_URL'),
    ],
    'support_email' => env('COMMUNITY_SUPPORT_EMAIL'),
    'child_safety_contact_email' => env('CHILD_SAFETY_CONTACT_EMAIL'),
];
