# Admin Typography Scale Design

## Goal

Unify typography across the Admin workspace using the MAW reference's compact visual hierarchy while preserving MIS/RYLAY branding, existing layouts, workflows, and responsive behavior. Dashboard remains the canonical visual reference. The separate School App is out of scope.

## Typography Scale

| Role | Size | Weight | Purpose |
| --- | ---: | ---: | --- |
| Page title | 28px | 700 | Primary page identity |
| Section and dialog title | 20px | 700 | Major content grouping |
| Card title | 16px | 600 | Card and panel identity |
| Body and form value | 14px | 400–500 | Main readable content |
| Form label and navigation | 13px | 600 | Controls and navigation hierarchy |
| Supporting text | 12px | 400–500 | Metadata, captions, descriptions |
| Table heading and eyebrow | 11px | 700 | Compact uppercase categorisation |
| Key metric | 24–30px | 700 | Dashboard and summary values |

Page titles use tight line height and slight negative letter spacing. Body copy uses a relaxed line height. Uppercase labels use restrained positive letter spacing. Excessive 800/900 weights are removed from ordinary UI text and retained only where a compact status marker or checkbox glyph needs additional optical weight.

## Implementation

Define Admin typography tokens alongside the existing global visual tokens. Apply them through shared semantic selectors and reusable Admin components first, then normalise page-specific exceptions that conflict with the scale. Preserve JetBrains Mono for technical Application Log values and payloads.

The hierarchy applies to navigation, page headings, panels, cards, tables, forms, buttons, dialogs, badges, empty states, and supporting metadata. Existing responsive rules may reduce page titles on narrow screens but must preserve the same relative hierarchy.

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
