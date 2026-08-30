# Admin Typography Scale Design

## Goal

Unify typography across the Admin workspace using the MAW reference's compact visual hierarchy while preserving MIS/RYLAY branding, existing layouts, workflows, and responsive behavior. Dashboard remains the canonical visual reference. The separate School App is out of scope.

## Typography Scale

| Role | Size | Weight | Purpose |
| --- | ---: | ---: | --- |
| Page title | 24px | 700 | Primary page identity |
| Section and dialog title | 18px | 700 | Major content grouping |
| Card title | 15px | 600 | Card and panel identity |
| Body copy | 14px | 400–500 | Main readable descriptions |
| Form value, table cell, label, button and navigation | 13px | 400–600 | Compact operational UI |
| Supporting text | 12px | 400–500 | Metadata, captions, status lines |
| Table heading and eyebrow | 11px | 700 | Compact uppercase categorisation |
| Key metric | 24px | 700–800 | Dashboard and summary values |

Page titles use tight line height and slight negative letter spacing. Body copy uses a relaxed line height. Uppercase labels use restrained positive letter spacing. Excessive 800/900 weights are removed from ordinary UI text and retained only where a compact status marker or checkbox glyph needs additional optical weight.

## Implementation

Define Admin typography tokens alongside the existing global visual tokens. Apply them through shared semantic selectors and reusable Admin components first, then normalise page-specific exceptions that conflict with the scale. Preserve JetBrains Mono for technical Application Log values and payloads.

The hierarchy applies to navigation, page headings, panels, cards, tables, forms, buttons, dialogs, badges, empty states, and supporting metadata. Existing responsive rules may reduce page titles on narrow screens but must preserve the same relative hierarchy.

## Shell Density

Use the source MAW Admin values rather than screenshot estimates. The desktop utility bar is 56px high with 32px horizontal padding. The sidebar brand area is 80px high. The main content container is centred, capped at 1600px, and uses 32px horizontal by 24px vertical padding on desktop, 24px horizontal by 20px vertical padding on tablets, and 16px horizontal by 20px vertical padding on phones. Page stacks use a 20px vertical rhythm while sibling cards keep the established 16px grid gap. Dashboard statistic cards use 20px internal padding.

## Visual Emphasis

Visual attention should flow from page title to key metrics, then section/card titles, followed by body content and metadata. Colour and spacing continue to carry state and grouping; heavier font weight must not be used as a substitute for hierarchy everywhere.

## Scope and Safety

- Admin presentation only; no API, permissions, data, or workflow changes.
- No typography change in `app/`.
- No package dependency is introduced.
- Existing print or document-specific typography may remain when it represents a separate output format.

## Verification

- Run the Admin branding contract test.
- Run focused shared Admin component tests where selectors or components change.
- Run the Admin TypeScript/Vite production build.
- Check the final diff for unrelated layout or App changes.
