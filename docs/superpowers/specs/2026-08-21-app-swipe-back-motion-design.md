# App Swipe-Back and Motion Design

**Status:** Approved for implementation

**Date:** 2026-08-21

## Objective

Bring the proven MAW Customer App gesture behavior into the RYLAY Community App while retaining RYLAY's MIS visual language, role-aware navigation, permissions, and existing bottom navigation capsule and its animation.

## Scope

- Replace duplicated secondary-page swipe logic with one reusable RYLAY swipe-back primitive.
- Apply it to Notifications and the existing full-screen secondary pages that currently use `subpage-slide-overlay`.
- Keep the current RYLAY bottom-tab capsule and tab animation unchanged.
- Add MAW-style secondary-page push, follow-finger drag, cancelled-gesture rebound, and completed pop animation.
- Add small, consistent modal entrance/exit motion only where an existing secondary-page surface is touched by this change.

This change does not alter APIs, authorization, role navigation, notification filtering, persistence, or business behavior.

## Gesture Contract

Swipe-back is available only on an open secondary page.

1. A gesture starts without moving the page.
2. Movement locks horizontal only when rightward movement exceeds 8 pixels and is at least 1.1 times the vertical movement.
3. Leftward or vertically dominated movement locks the gesture away from swipe-back.
4. Once horizontally locked, the secondary page follows the finger using `translate3d`; the underlying page remains mounted and visually stable.
5. Releasing completes the return when the drag exceeds 30% of the visible app width, or when a rightward flick exceeds 45 pixels within 250 milliseconds.
6. An incomplete gesture returns smoothly to zero without navigating.
7. A completed gesture animates to the right edge, then invokes the page's existing back/close callback exactly once.
8. `touchcancel` follows the same safe completion/reset path as `touchend`.

Swipe-back must not begin from:

- the Notification category scroller;
- inputs, textareas, selects, buttons, or elements marked `data-prevent-swipe="true"`;
- elements marked `data-horizontal-scroll="true"`;
- dialogs or horizontal overflow containers.

The Notification category scroller will be explicitly marked as horizontal-scroll content. Swiping either direction over its category pills scrolls the pills and never closes Notifications. A leftward gesture anywhere must never trigger back.

## Component Design

A reusable hook/component in `app/src/components/` will own gesture refs, direction locking, velocity/distance thresholds, drag state, completion timing, and reduced-motion behavior. Consumers supply their existing `onBack` or `onClose` callback and render their existing page content inside it.

The primitive exposes styling hooks for:

- entering from the right;
- dragging without a transition;
- spring-like rebound using the MAW timing curve;
- exiting to the right;
- a restrained left-side shadow that communicates page depth.

Existing page-specific data loading, forms, headers, and callbacks stay in their current components. The shared primitive does not know page routes, roles, permissions, or API state.

## Motion Rules

- Secondary-page entrance: 260 milliseconds, `cubic-bezier(0.25, 1, 0.5, 1)`.
- Rebound/pop: 220 milliseconds with the same curve.
- Dialog/sheet surfaces touched by this work use a restrained fade plus scale or bottom slide, without continuous decorative animation.
- `prefers-reduced-motion: reduce` disables travel animations and completes callbacks without an artificial delay.
- The existing RYLAY bottom capsule, active-item animation, and tab presentation remain unchanged.

## Error and State Handling

- Gesture state resets when a page closes or the component unmounts.
- Back callbacks are guarded while exit is in progress to prevent duplicate navigation.
- Interactive and horizontal-scroll exclusions are resolved from the original touch target before direction locking.
- Existing loading, API error, unread-count, filter, and navigation behavior is preserved.

## Verification

Focused component tests will cover:

- Notification category swipes in both directions do not close the page.
- Leftward page gestures do not trigger back.
- Rightward threshold and fast-flick gestures trigger back once.
- Short rightward gestures rebound without closing.
- Vertical gestures and ignored interactive targets do not trigger back.
- Existing Notification filtering and bottom navigation behavior remain intact.

Run the focused App Vitest files, App lint, and App production build. Deep browser/device QA and MariaDB verification are outside this frontend-only motion change.
