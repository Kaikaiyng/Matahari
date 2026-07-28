# Responsive Modal UI Design

**Date:** 2026-07-28

**Status:** Approved for implementation planning
**Primary surfaces:** PC and iPad landscape/portrait

## Purpose

Make every existing Matahari dialog easy to learn, scan, and operate on a PC and an iPad. The redesign keeps the current business logic, permissions, API payloads, visual language, and fixed header/body/footer structure while giving simple forms, complex finance workflows, and destructive confirmations layouts suited to their actual tasks.

The approved direction is a shared modal framework upgrade rather than isolated CSS patches or a conversion to drawers and multi-step wizards.

## Evidence

The current implementation was reviewed in the running application at:

- PC: 1440×900
- iPad landscape: 1180×820
- iPad portrait: 820×1180

The evidence set and audit are stored outside the production source tree at:

`C:\Users\chong\.codex\visualizations\2026\07\28\019fa6b8-0717-7852-8b4d-e5a91e734f14\modal-audit`

Confirmed problems include:

- `Record Payment` uses most of its first screen for secondary payment metadata while fee selection, allocation, and balance status appear below the fold.
- Wide finance dialogs can exceed the iPad backdrop content width and crop the close control.
- The global iPad rule that makes every primary action full width creates an isolated Cancel button above a full-width primary button.
- The Fee Agreement review panel follows the full editor on iPad, so users do not see totals and changes early enough.
- Destructive confirmations do not show enough identifying context or consequences.
- The shared modal restores focus and handles Escape, but it does not trap focus, isolate the background, associate description text, or lock background scrolling.
- `Manual Charge` and `One-time charge` describe the same user concept with inconsistent language.

## Goals

- Give every dialog a predictable title, content, and action hierarchy.
- Keep the next action obvious without making every primary button fill the iPad width.
- Put the core decision or work area before secondary metadata.
- Prevent clipping, accidental page-level scrolling, and hidden controls at all target viewports.
- Make long workflows easier to scan without changing their business behavior.
- Give destructive actions clear target context and consequences.
- Provide robust keyboard, focus, and assistive-technology behavior.
- Preserve desktop productivity while treating iPad portrait and landscape as first-class layouts.

## Non-goals

- Changing backend business rules, permissions, payloads, or finance calculations.
- Replacing dialogs with drawers, pages, or multi-step wizards.
- Rebranding, changing the global color system, or introducing decorative animation.
- Redesigning page content outside the dialogs except where background isolation is required.
- Adding a new component library or state-management framework.
- Changing receipt print layout.
- Optimizing phone layouts beyond preserving current responsive behavior.

## Dialog Inventory

| Dialog | Type | Primary task |
| --- | --- | --- |
| Create Student Profile | Standard | Add a student |
| Create Fee Agreement | Workflow | Configure and review a new agreement |
| Supersede Fee Agreement | Workflow | Change an agreement and review the difference |
| Add Manual Charge | Standard | Add a one-time student charge |
| Record Payment | Workflow | Record money and allocate it to fees |
| Verify Payment | Standard confirmation | Confirm received details and verify |
| Void Payment | Danger | Explain and confirm payment reversal |
| Void Receipt | Danger | Explain and confirm receipt invalidation |
| Add Calendar Event | Standard | Create an event |
| Edit / View Calendar Event | Standard | Update or inspect an event |
| Delete Calendar Event | Danger | Permanently remove an event |

The receipt viewer is a document surface, not a `ModalFrame`, and remains outside this dialog redesign.

## Design Principles

1. **One dialog, one task.** Titles and descriptions state the task and its consequence.
2. **The result leads the controls.** Amount balance, agreement total, and destructive target details appear before low-frequency fields.
3. **Progressive disclosure.** Advanced settings remain available without competing with the common path.
4. **Stable action location.** Header and footer remain visible while only the body scrolls.
5. **Responsive composition, not simple stacking.** iPad layouts change hierarchy as well as column count.
6. **Plain operational language.** User-facing copy avoids internal accounting and API terminology.
7. **Safe escape.** Cancel, Close, Escape, validation recovery, and focus restoration behave consistently.

## Shared Modal Architecture

`ModalFrame` remains the single dialog primitive. It gains explicit presentation and semantic variants instead of relying on caller-specific width classes and page-level button rules.

Proposed public properties:

```ts
type ModalSize = 'compact' | 'standard' | 'workflow'
type ModalTone = 'default' | 'danger'

type ModalFrameProps = {
  title: string
  description?: string
  size?: ModalSize
  tone?: ModalTone
  onClose: () => void
  footer: ReactNode
  children: ReactNode
  className?: string
  initialFocusRef?: RefObject<HTMLElement | null>
}
```

Defaults remain `size="standard"` and `tone="default"` so existing callers can migrate incrementally without changing behavior.

### Size Contracts

- `compact`: confirmations and short forms; approximately 520–600px on PC.
- `standard`: student, one-time charge, and calendar forms; approximately 680–760px on PC.
- `workflow`: Fee Agreement and Record Payment; approximately 1080–1180px on PC.

All widths are constrained by the backdrop content box, not `100vw`, and include safe-area-aware horizontal margins.

### Structure

Every dialog contains:

1. Header: title, optional description, close button.
2. Optional context/summary area at the start of the body.
3. Scrollable body containing sections with clear headings.
4. Footer containing secondary and primary actions.

Only the body scrolls. The header and footer remain visible. A subtle top or bottom shadow may appear only when content continues beyond the visible body, providing a non-text visual cue without adding decoration.

### Background and Focus Behavior

When a dialog opens:

- Save the previously focused element.
- Lock document background scrolling without changing the visible page position.
- Make the application background inert for keyboard and assistive-technology interaction.
- Move focus to `initialFocusRef` when provided; otherwise use the close button.
- Associate the dialog with both title and description through `aria-labelledby` and `aria-describedby`.

While open:

- Tab and Shift+Tab cycle within the dialog.
- Escape calls the existing `onClose`, preserving unsaved-change handling owned by the caller.
- Focus cannot enter the page behind the dialog.

When closed:

- Remove scroll lock and inert state.
- Restore focus to the original trigger if it still exists.
- Avoid changing the page scroll position.

## Responsive Layout Rules

### PC: 1024px and Above

- Compact and standard dialogs are centered.
- Workflow dialogs use the available width without touching viewport edges.
- Footer actions are one row, right aligned. A destructive tertiary action such as `Delete event` may align left while Cancel and Save align right.
- Fields use two or three columns only when the labels, inputs, and validation remain readable.
- Primary workflow summaries may use a sticky side panel inside the dialog body.

### iPad Landscape: 1024–1180px

- Dialogs retain centered floating presentation with at least 20px safe margins.
- Workflow dialogs use nearly the available width, constrained to the backdrop content box.
- Standard forms use two columns where fields are naturally paired.
- Footer actions remain together and right aligned; they do not inherit page-level `width: 100%`.
- Touch targets are at least 44px.

### iPad Portrait: 768–1023px

- Dialogs retain at least 16px safe margins and never exceed the visible content width.
- Standard forms use two columns for short fields; wide text fields and text areas span both columns.
- Workflow dialogs use a single primary content column with a compact, early summary.
- Footer actions remain side by side when they fit. If they do not fit, the entire action group stacks consistently, with the primary action first visually and Cancel directly adjacent in the next row. No isolated button is allowed.
- The body height uses `100dvh` and safe-area insets rather than only `100vh`.

### Phone Preservation

Below 768px, the existing near-full-height sheet behavior remains. Fields use one column, and the footer may stack as a complete group. This pass must not introduce phone horizontal overflow.

## Dialog-Specific Designs

### Create Student Profile

The field order remains:

1. Student ID
2. Student Name
3. Level Group
4. Class
5. Initial Status
6. Gender
7. Date of Birth
8. Registration Date
9. Remarks

PC may use three columns. Both iPad orientations use two columns, with Student Name and Remarks allowed to span columns when needed. Validation remains directly below its field. Cancel and Create Student remain together in the footer.

### Fee Agreement

#### PC

The existing editor and review panel remain a two-column workflow:

- Main editor: agreement details, core fees, optional fees, discount.
- Sticky review: subtotal, discount, total, coverage, warnings, and Supersede changes.

The dialog width is constrained correctly so the close button and scrollbar remain inside the safe margin.

#### iPad

The review panel becomes an early summary positioned after the version context and before the detailed fee editor. It shows:

- Preview total
- Coverage
- Core fee count
- Warning or change count
- `Review details` expand control

Expanded review details stay in document flow; no nested modal or side drawer is introduced. This gives users the result early while keeping detailed comparison available.

Core fee rows remain compact. Advanced billing controls open on demand. The footer always shows Cancel and Create/Supersede together.

### One-time Charge

The user-facing title and actions change from `Manual Charge` to `One-time Charge`. Internal API names, state variables, and charge classification remain unchanged.

Field order:

1. Academic Year
2. Billing Month
3. Category
4. Amount
5. Description
6. Remark

PC and iPad use two columns for the first four fields. Description and Remark span the full width. The placeholder examples remain available but do not substitute for a visible label.

### Record Payment

This is the highest-priority workflow.

#### Task Order

The dialog presents four numbered or clearly titled sections:

1. Payment amount and method
2. Fees this payment will clear
3. Allocation and balance check
4. Additional payment details

The sections do not create a wizard; all remain accessible in one dialog.

#### PC Composition

The body uses two areas:

- Main work area: amount/method, outstanding fees, selected allocations.
- Summary/details area: balanced status and collapsible additional details.

Outstanding fees and allocation are visible in the first screen at 1440×900. Received date, bank account, proof text, reference, paid by, and remark move into an `Additional payment details` section unless required by the selected payment method.

The amount balance summary remains visible while the allocation list scrolls. The existing selection, partial allocation, one-time charge, and unclassified payment behavior remains unchanged.

#### iPad Composition

The body is a single ordered column:

1. Amount, method, payment date
2. Outstanding fees
3. Payment allocation
4. Balance summary
5. Additional payment details
6. Advanced options

The balance summary remains in normal document flow immediately after Payment allocation. It uses a high-contrast treatment and appears before Additional payment details, avoiding a second sticky layer that could conflict with the fixed footer. The footer remains Cancel and Record Payment.

#### Copy

- `Outstanding fees` remains.
- `Payment allocation` remains.
- `Add one-time charge` remains and opens the compact inline creator.
- `Advanced options` continues to contain `Record unclassified payment`.
- Status text explicitly explains `Balanced`, `Amount remaining`, or `Over-allocated`.

### Verify Payment

The dialog begins with a compact payment summary:

- Student
- Amount
- Payment method
- Payment date
- Reference number when present

Received Date and Bank Reference follow. The primary action is `Verify Payment`. The dialog uses standard size, not workflow size.

### Void Payment

The dialog uses `tone="danger"` and compact size. It shows:

- Student
- Amount
- Payment date and method
- Receipt status
- Consequence: the payment becomes void and related balances may reopen according to existing business rules.

Void Reason remains required. The primary action is `Confirm Void Payment`, styled with the danger action token rather than the normal brand primary style.

### Void Receipt

The dialog uses `tone="danger"` and compact size. It shows:

- Receipt number
- Student or paid-by name
- Receipt date
- Amount
- Consequence: the issued receipt becomes void and cannot be treated as an active receipt.

Void Reason remains required. The primary action is `Confirm Void Receipt`.

### Calendar Event

Add and Edit use standard size. Both iPad orientations retain two columns for paired date/time fields. Title, Location, Participants, and Notes span the full width when appropriate.

Edit mode keeps `Delete event` visually separate on the footer's left. Cancel and Save changes remain together on the right. View-only mode omits form affordances that imply editability.

Existing Calendar close behavior is preserved. Adding a new unsaved-change confirmation is outside this pass because it changes interaction behavior beyond the responsive dialog redesign.

### Delete Calendar Event

The confirmation uses compact danger presentation. It shows the event title, date/time, and location when present. The copy states that deletion is permanent. `Cancel deletion` and `Delete event` stay together; the primary destructive action uses the danger token.

## Action Hierarchy

The shared footer follows these rules:

- Primary action: one per dialog.
- Secondary action: Cancel or Close.
- Destructive action: explicit danger style; never represented only by the normal brand-red primary style.
- Tertiary destructive action in an editor: left aligned and visually less prominent than the final confirmation.
- Loading labels preserve button width where practical.
- Disabled state remains visibly distinct and retains readable text contrast.

Page-level responsive styles must not force modal footer buttons to full width on iPad. Modal action layout is owned by the modal component stylesheet.

## Validation and Error Recovery

- Field errors remain adjacent to their fields.
- Dialog-level API errors appear before the relevant section, not only at the top of a long body.
- On submit failure, focus moves to the first invalid field or the dialog-level error.
- The body scrolls the first invalid control into view without moving the page behind the dialog.
- Loading states disable duplicate submission while keeping Cancel available unless closing would corrupt an in-flight operation.
- Long errors wrap without changing dialog width.
- Existing unsaved Fee Agreement confirmation remains intact.

## Accessibility Requirements

- Dialog has `role="dialog"` and `aria-modal="true"`.
- Title and optional description have stable generated IDs.
- Focus is trapped and restored.
- Background is inert and scroll locked.
- Close has an explicit accessible name.
- Visible focus rings are not clipped by the dialog.
- All interactive targets are at least 44px on iPad.
- Body text and status text retain at least 4.5:1 contrast.
- Danger meaning is expressed by text and iconography, not color alone.
- Reduced-motion preferences are respected; no new required motion is added.
- Zoom to 200% does not introduce page-level horizontal scrolling.

## Component Boundaries

Expected source changes are focused on:

- `frontend/src/components/AdminUi.tsx`
- `frontend/src/components/AdminUi.css`
- `frontend/src/components/AdminUi.test.tsx`
- `frontend/src/App.tsx`
- `frontend/src/App.css`
- `frontend/src/App.test.tsx`
- `frontend/src/components/CalendarPage.tsx`
- `frontend/src/components/CalendarPage.css`
- `frontend/src/components/CalendarPage.test.tsx`
- Fee Agreement component CSS only where the early iPad review summary needs layout support

Add one small `ModalContextSummary` component with default and danger tones. Reuse it for Verify Payment, Void Payment, Void Receipt, and Delete Calendar Event. No general component-library refactor is planned.

## Verification

Automated:

- Modal focus trap cycles with Tab and Shift+Tab.
- Escape invokes close.
- Initial focus and focus restoration work.
- Description is associated through `aria-describedby`.
- Background scroll lock and inert state are added and removed.
- Size and tone classes render correctly.
- Existing modal open/close and submission tests continue to pass.
- Copy and summary tests cover One-time Charge, Verify Payment, Void Payment, Void Receipt, and Calendar deletion.
- Fee Agreement and Record Payment keep their existing business behavior tests.
- `npm.cmd run test`
- `npm.cmd run lint`
- `npm.cmd run build`
- `git diff --check`

Visual browser QA:

- PC: 1440×900
- iPad landscape: 1180×820
- iPad portrait: 820×1180
- Phone regression: 390×844

At every target size, inspect all dialogs in the inventory. Verify initial and scrolled states for Fee Agreement, Record Payment, and Calendar Event. Confirm that no close button, focus ring, field, scrollbar, or footer action is clipped.

## Acceptance Criteria

The redesign is complete only when:

- Every listed dialog uses an explicit compact, standard, or workflow contract.
- No dialog or close control is horizontally clipped at the target viewports.
- iPad footer actions follow a consistent grouped layout.
- Record Payment shows fee selection or a clear fee-selection entry and balance status in the first screen.
- Fee Agreement shows total or review-summary access before the detailed iPad editor.
- Danger dialogs show the target, consequence, reason field, and distinct danger action.
- User-facing `Manual Charge` copy is replaced by `One-time Charge` in the affected dialog and actions.
- Keyboard focus cannot escape an open dialog.
- Background scrolling and interaction are blocked while a dialog is open.
- Closing restores focus to the trigger.
- Existing finance, student, and calendar behavior is unchanged.
- Automated checks pass.
- PC and iPad browser QA passes with accepted screenshots.
- Any limitation requiring a real iPad device is documented rather than treated as verified.
