# App Support Preview Design QA

- Source visual truth: `C:\Users\chong\AppData\Local\Temp\rylay-design-qa\maw-app-support-reference.png` (live MAW Settings > App Support)
- Implementation: `C:\Users\chong\AppData\Local\Temp\rylay-design-qa\rylay-app-support-implementation.png` (local RYLAY Settings > App Support)
- Viewport: 1920 CSS px wide; MAW 945 px high, RYLAY 889 px high
- Captures: 1920×945 and 1920×889 PNG at the browser's normalized screenshot size; browser-reported device pixel ratio was 2
- State: authenticated Super Admin, App Support section open, empty RYLAY school contacts showing preview fallbacks

## Full-view comparison evidence

The two live pages were captured in the same Chrome session and compared together. RYLAY preserves its existing MIS navigation, school terminology, and brand colour while matching the MAW right-side preview hierarchy: bordered preview frame, uppercase heading and badge, inner modal card, support header, three channel rows, and a separate operating-hours footer.

## Focused region comparison evidence

The right-side preview was readable at full-view scale, so a separate crop was not required. Typography weight, 10–13 px support text hierarchy, 10–16 px spacing rhythm, 12–16 px radii, subtle borders/shadows, semantic green phone/WhatsApp icons, MIS email/hero colour, and MAW copy structure were checked directly.

## Findings

- No actionable P0, P1, or P2 mismatch remains in the requested right-side preview.
- The MIS colour substitution and School App terminology are intentional product adaptations.
- Empty form values use visual-only example fallbacks; configured values replace them immediately and are not persisted until Save is used.
- No raster image assets are present in this component; existing Lucide interface icons remain consistent with RYLAY.

## Interaction and runtime evidence

- Settings and App Support navigation were exercised in the browser.
- The preview rendered all three channel cards and Hours while configuration was empty.
- Admin focused tests passed 7/7 and the production build passed.
- App focused public-support tests passed 3/3, covering call, WhatsApp, email, and operating-hours consumption from the school support payload.
- Console was checked. Four Chrome-extension asynchronous message-channel entries were present without an application stack or source; no RYLAY render/runtime failure was observed.

## Comparison history

1. Before: the RYLAY preview omitted channel cards when values were empty and lacked the MAW modal frame/header/badge structure.
2. Fix: copied the MAW preview composition and spacing, retained MIS tokens, and added non-persisted empty-state examples.
3. After: live browser capture shows the requested MAW structure with RYLAY branding; no P0/P1/P2 finding remains.

## Follow-up polish

- P3: school-specific example copy could later derive from tenant branding instead of the neutral `support@rylay.my` fallback.

final result: passed

---

# Historical Design QA: Sidebar Brand Mark Contrast

> **Historical QA evidence (2026-08-07).** This validates the Admin sidebar contrast fix only. It predates the independent Community App and its 2026-08-13 liquid-glass navigation QA; use [Design System](DESIGN.md) and [Current Status](docs/current-status.md) for the current visual baseline. Local temporary screenshot paths below are provenance notes and are not required project assets.

## Evidence

- Source visual truth path: user-provided conversation attachment showing the expanded sidebar brand crop (508 x 213 pixels), received 2026-08-07.
- Implementation screenshot path: `C:\Users\chong\AppData\Local\Temp\rylay-sidebar-icon-after.jpg`.
- Viewport: expanded authenticated desktop shell at 1920 x 911 CSS pixels.
- Source pixels: 508 x 213. Implementation pixels: 1920 x 911. The Chrome capture was normalized to CSS size even though the browser reported device pixel ratio 2.
- State: Dashboard selected, sidebar expanded.
- Browser evidence: the rendered school icon measured 27 x 27 CSS pixels and computed to `rgb(255, 255, 255)`; no console errors were present.

## Full-View Comparison

The sidebar structure, 48-pixel blue mark container, brand copy, navigation spacing, utility header, and dashboard layout remain unchanged from the supplied source state. The only intentional visible difference is that the school icon now renders white instead of muted grey, restoring the intended blue/white brand contrast.

## Focused Region Comparison

The supplied visual is already a focused crop of the brand region. The post-fix full-view capture keeps the mark clearly readable at the same expanded desktop state, and the computed foreground color confirms the visible white result. A second crop was not needed because the vector mark is legible in the full-resolution implementation capture and its exact size and color were measured directly.

## Required Fidelity Surfaces

- Fonts and typography: unchanged; School Admin and System retain their existing family, weights, sizes, and hierarchy.
- Spacing and layout rhythm: unchanged; brand container, icon box, copy gap, sidebar width, radius, and divider remain intact.
- Colors and visual tokens: corrected; the blue mark background remains unchanged and the icon now uses the shared white BrandMark foreground.
- Image quality and asset fidelity: the existing Lucide school icon remains a sharp vector at 27 x 27 pixels; no raster asset, replacement logo, or scaling change was introduced.
- Copy and content: unchanged.

## Findings

- No remaining P0, P1, or P2 findings.
- No P3 follow-up is required for this scoped correction.

## Comparison History

1. Initial finding (P2): `.admin-brand span` applied muted text color to every span in the brand row, including the reusable mark, causing a low-contrast grey icon on blue.
2. Fix: narrowed all brand-copy selectors to `.admin-brand-copy`, leaving the reusable mark's white foreground untouched.
3. Post-fix evidence: the implementation capture shows the white icon; computed color is `rgb(255, 255, 255)`; focused branding and shell tests, lint, and production build pass.

## Implementation Checklist

- [x] Limit muted text styling to brand copy.
- [x] Preserve icon size, container, typography, layout, and behavior.
- [x] Add a regression contract for selector scope.
- [x] Verify the authenticated desktop render and console.

final result: passed
