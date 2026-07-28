# Responsive Modal UI Design

**Date:** 2026-07-28

**Status:** Design-reviewed; ready for implementation planning
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

The design-review mockup generator is not installed in this workspace, so the review used the audited production screenshots above as its visual evidence. Those screenshots are sufficient to confirm hierarchy, clipping, density, and action-layout problems; implementation still requires fresh comparison screenshots and interactive keyboard testing.

## What already exists

The implementation should extend the existing Matahari UI rather than introduce a parallel design language:

- `ModalFrame` already provides the shared title, description, close control, scrollable body, fixed footer, Escape handling, and focus restoration.
- `PageHeader`, `InlineMessage`, `Message`, `.form-field`, `.primary-action`, `.secondary-action`, and `.danger-action` provide the current component and action vocabulary.
- `FeeAgreementEditor` already separates the editable agreement from a review panel and supports progressive disclosure for billing details.
- `PaymentAllocationEditor` already owns outstanding-fee loading, empty, error, allocation, one-time charge, and advanced unclassified-payment states.
- The existing CSS variables for brand red, text, muted text, borders, canvas, and surface remain the source of truth.
- Calendar forms already use explicit labels, two-column date/time composition from 768px upward, and `aria-invalid` on several controls.

No `DESIGN.md` exists. This pass therefore uses the current components and CSS tokens plus universal application-UI principles. Creating a full product-wide design system is outside this modal-focused change.

## Goals

- Give every dialog a predictable title, content, and action hierarchy.
- Keep the next action obvious without making every primary button fill the iPad width.
- Put the core decision or work area before secondary metadata.
- Prevent clipping, accidental page-level scrolling, and hidden controls at all target viewports.
- Make long workflows easier to scan without changing their business behavior.
- Give destructive actions clear target context and consequences.
- Provide robust keyboard, focus, and assistive-technology behavior.
- Preserve desktop productivity while treating iPad portrait and landscape as first-class layouts.

## NOT in scope

- Changing backend business rules, permissions, payloads, or finance calculations.
- Replacing dialogs with drawers, pages, or multi-step wizards.
- Rebranding, changing the global color system, or introducing decorative animation.
- Redesigning page content outside the dialogs except where background isolation is required.
- Adding a new component library or state-management framework.
- Changing receipt print layout.
- Optimizing phone layouts beyond preserving current responsive behavior.
- Replacing the existing Inter-based typography or creating a product-wide typography system.
- Redesigning page navigation, tables, dashboards, or empty states outside an open dialog.

## Dialog Inventory

| Dialog | Type | Primary task |
| --- | --- | --- |
| Create Student Profile | Standard | Add a student |
| Create Fee Agreement | Workflow | Configure and review a new agreement |
| Supersede Fee Agreement | Workflow | Change an agreement and review the difference |
| One-time Charge (current Add Manual Charge) | Standard | Add a one-time student charge |
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

- `compact`: confirmations and short forms; 560px target width and 640px maximum height on PC.
- `standard`: student, one-time charge, and calendar forms; 720px target width and 760px maximum height on PC.
- `workflow`: Fee Agreement and Record Payment; 1120px target width and 860px maximum height on PC.

Every maximum height is also constrained by `calc(100dvh - the required top and bottom margins)`. All widths are constrained by the backdrop content box, not `100vw`, and include safe-area-aware horizontal margins.

Each size maps to an explicit `modal-frame--compact`, `modal-frame--standard`, or `modal-frame--workflow` class. The existing `.financial-modal` width rule is removed or reduced to business-layout styling so it cannot override the shared size contract.

### Structure

Every dialog contains:

1. Header: title, optional description, close button.
2. Optional context/summary area at the start of the body.
3. Scrollable body containing sections with clear headings.
4. Footer containing secondary and primary actions.

Only the body scrolls. The header and footer remain visible. A subtle top or bottom shadow appears only when content continues beyond the visible body, providing a non-text visual cue without adding decoration. The scrollable body uses contained overscroll and momentum scrolling on iPad.

### Background and Focus Behavior

`ModalFrame` renders its backdrop and dialog through a React portal attached to `document.body`. This makes the modal a sibling of `#root`, allowing the entire application root to become inert without disabling the modal itself. The component restores the previous `#root` inert and `aria-hidden` values and the previous body overflow styles when it unmounts.

Only one `ModalFrame` is active at a time in the current application. Calendar deletion replaces the edit dialog rather than nesting a second dialog. Backdrop clicks do not close a dialog because forms may contain unsaved work; Close, Cancel, and Escape remain the explicit exits.

When a dialog opens:

- Save the previously focused element.
- Lock document background scrolling without changing the visible page position.
- Make the application background inert for keyboard and assistive-technology interaction.
- Move focus to `initialFocusRef` when provided.
- For editable forms, target the first meaningful editable field.
- For danger confirmations, target the safe Cancel action, never the destructive action.
- For read-only dialogs, fall back to the Close control.
- Associate the dialog with the title through `aria-labelledby` and with the optional description through `aria-describedby`; omit `aria-describedby` when no description exists.

While open:

- Tab and Shift+Tab cycle within the dialog.
- Escape calls the existing `onClose`, preserving unsaved-change handling owned by the caller.
- Focus cannot enter the page behind the dialog.
- Focus moves to the first invalid control or dialog-level error after a failed submit.

When closed:

- Remove scroll lock and inert state.
- Restore focus to the original trigger if it still exists.
- Avoid changing the page scroll position.

## Responsive Layout Rules

### PC: 1181px and Above

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
- Footer actions remain side by side when they fit. If they do not fit, the entire action group stacks consistently as full-width rows in the same DOM and visual order: secondary action first, primary action second. CSS must not visually reorder controls. No isolated narrow button is allowed.
- The body height uses `100dvh` and safe-area insets rather than only `100vh`.

### Phone Preservation

Below 768px, the existing near-full-height sheet behavior remains. Fields use one column, and the footer may stack as a complete group with both actions full width, secondary first and primary second. This pass must not introduce phone horizontal overflow.

These viewport ranges are mutually exclusive. Device detection and user-agent checks are not used; layout follows the available viewport width so split-screen iPad and resized PC windows behave predictably.

## Information Architecture

Every dialog follows the same scan path:

```text
Trigger
  -> Header: task + one-sentence purpose + Close
  -> Context: who/what is affected
  -> Work: the minimum fields or decision needed now
  -> Status: total, balance, warning, or consequence
  -> Details: optional or advanced information
  -> Footer: safe exit + one primary action
  -> Success: close, restore focus, show page-level confirmation
```

The three things that must remain easiest to find are:

1. What the user is doing.
2. Which student, payment, receipt, or event is affected.
3. What action completes the task and what consequence follows.

Finance workflows use this more specific hierarchy:

```text
Student identity
  -> Result-driving inputs
  -> Fee or agreement decision workspace
  -> Total/balance/review state
  -> Supporting details
  -> Advanced exceptions
```

Supporting metadata must never push the decision workspace or its outcome below the first useful screen.

## Dialog-Specific Designs

### Shared Finance Context

Fee Agreement, One-time Charge, Record Payment, Verify Payment, Void Payment, and Void Receipt show the selected student's name and student ID near the start of the dialog. This context is compact, does not repeat the page heading, and remains visible before any financial amount or destructive action. Payment and receipt confirmations add their own reference or receipt number to the same summary.

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

PC may use three columns. Both iPad orientations use two columns, with Student Name and Remarks allowed to span columns when needed. Validation remains directly below its field. Initial focus moves to Student ID. Cancel and Create Student remain together in the footer.

### Fee Agreement

#### PC

The existing editor and review panel remain a two-column workflow:

- Student identity and version context.
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

Core fee rows remain compact. Advanced billing controls open on demand. Initial focus moves to Payment Plan. The footer always shows Cancel and Create/Supersede together.

### One-time Charge

The user-facing title and actions change from `Manual Charge` to `One-time Charge`. Internal API names, state variables, and charge classification remain unchanged.

Field order:

1. Academic Year
2. Billing Month
3. Category
4. Amount
5. Description
6. Remark

PC and iPad use two columns for the first four fields. Description and Remark span the full width. The placeholder examples remain available but do not substitute for a visible label. Initial focus moves to Academic Year.

### Record Payment

This is the highest-priority workflow.

#### Task Order

The dialog first identifies the student, then presents five numbered or clearly titled sections:

1. Payment basics: Academic Year, Payment Method, Amount, Payment Date, and Received Date when required
2. Fees this payment will clear
3. Allocation and balance check
4. Additional payment details
5. Advanced options

The sections do not create a wizard; all remain accessible in one dialog.

#### PC Composition

The body uses two areas:

- Main work area: amount/method, outstanding fees, selected allocations.
- Summary/details area: balanced status and collapsible additional details.

Outstanding fees and allocation are visible in the first screen at 1440×900. Bank account, proof text, reference, paid by, and remark move into a collapsed `Additional payment details` section. Received Date stays in Payment basics for cash because the current API requires it; for other methods it moves into Additional payment details.

Additional payment details opens automatically when it contains a value, contains a validation error, or the selected payment method makes one of its fields required. It must never hide an error.

The amount balance summary remains visible while the allocation list scrolls. The existing selection, partial allocation, one-time charge, and unclassified payment behavior remains unchanged.

#### iPad Composition

The body is a single ordered column:

1. Academic year, amount, method, payment date, and conditionally received date
2. Outstanding fees
3. Payment allocation
4. Balance summary
5. Additional payment details
6. Advanced options

The balance summary remains in normal document flow immediately after Payment allocation. It uses a high-contrast treatment and appears before Additional payment details, avoiding a second sticky layer that could conflict with the fixed footer. The footer remains Cancel and Record Payment.

Initial focus moves to Amount when an Academic Year is already selected; otherwise it moves to Academic Year. Loading outstanding fees retains the section heading and shows an inline progress state. An empty outstanding-fee result explains that no fees are available for the selected year and keeps `Add one-time charge` available when the role has permission.

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

Received Date, Bank Account, Reference No, and Remark follow. The primary action is `Verify Payment`. The dialog uses standard size, not workflow size.

The summary also includes the current verification status. Initial focus moves to Received Date. Successful verification closes the dialog, restores focus to the Verify trigger, refreshes the payment row, and shows the existing page-level confirmation.

### Void Payment

The dialog uses `tone="danger"` and compact size. It shows:

- Student
- Amount
- Payment date and method
- Payment status
- Receipt status and receipt number when present
- Consequence for a verified payment: the payment becomes void and each applied charge reopens by the allocated amount.
- Consequence for a pending payment: the payment becomes void but no charge balance changes because the payment was not yet applied.

If an issued receipt exists, the dialog becomes a blocking explanation rather than an actionable confirmation: it identifies the receipt, states `Void the issued receipt before voiding this payment`, and does not expose an enabled payment-void submit action. This mirrors the existing backend rule instead of allowing a predictable 422 error.

Void Reason remains required only when the payment is eligible to be voided. Initial focus moves to Cancel. The primary action is `Confirm Void Payment`, styled with the danger action token rather than the normal brand primary style.

### Void Receipt

The dialog uses `tone="danger"` and compact size. It shows:

- Receipt number
- Student or paid-by name
- Receipt date
- Amount
- Payment reference when present
- Consequence: the receipt becomes void, its number is not reused, the linked payment remains verified, and student balances do not change until the payment itself is separately voided.

Void Reason remains required. Initial focus moves to Cancel. The primary action is `Confirm Void Receipt`.

### Calendar Event

Add, Edit, and View use stable, concise titles: `Add Calendar Event`, `Edit Calendar Event`, and `View Calendar Event`. The event's full title appears in the body/context instead of being concatenated into the modal heading, so long event names cannot crowd the close control.

Add and Edit use standard size. Both iPad orientations retain two columns for paired date/time fields. Title, Location, Participants, and Notes span the full width when appropriate.

Edit mode keeps `Delete event` visually separate on the footer's left. Cancel and Save changes remain together on the right. View-only mode uses `Close` instead of `Cancel` and omits form affordances that imply editability. Initial focus moves to Title for Add/Edit and Close for view-only.

Existing Calendar close behavior is preserved. Adding a new unsaved-change confirmation is outside this pass because it changes interaction behavior beyond the responsive dialog redesign.

### Delete Calendar Event

The confirmation uses the stable title `Delete Calendar Event?` with compact danger presentation. It shows the full event title, date/time, and location when present. The copy states that deletion is permanent. Initial focus moves to `Cancel deletion`. `Cancel deletion` and `Delete event` stay together; the primary destructive action uses the danger token.

## Action Hierarchy

The shared footer follows these rules:

- Primary action: one per dialog.
- Secondary action: Cancel or Close.
- Destructive action: explicit danger style; never represented only by the normal brand-red primary style.
- Tertiary destructive action in an editor: left aligned and visually less prominent than the final confirmation.
- Loading labels preserve button width where practical.
- Disabled state remains visibly distinct and retains readable text contrast.
- Footer DOM order matches visual and keyboard order. The safe secondary action precedes the primary action; responsive CSS may change grouping or width but not reorder them.

Page-level responsive styles must not force modal footer buttons to full width on iPad. Modal action layout is owned by the modal component stylesheet.

## Validation and Error Recovery

- Field errors remain adjacent to their fields.
- Invalid controls use `aria-invalid="true"` and reference their error text through `aria-describedby`.
- Dialog-level API errors appear before the relevant section, not only at the top of a long body.
- Dialog-level errors use `role="alert"` and receive a programmatic focus target with `tabIndex={-1}`.
- On submit failure, focus moves to the first invalid field or the dialog-level error.
- The body scrolls the first invalid control into view without moving the page behind the dialog.
- Loading states disable duplicate submission while keeping Cancel available unless closing would corrupt an in-flight operation.
- Long errors wrap without changing dialog width.
- Existing unsaved Fee Agreement confirmation remains intact.

## Interaction State Coverage

| Feature | Loading | Empty | Error | Success | Conditional / partial |
| --- | --- | --- | --- | --- | --- |
| Standard forms | Primary label changes to an in-progress verb and duplicate submit is disabled | Not applicable; fields remain visible | Field errors stay beside controls and the first invalid control receives focus | Dialog closes, trigger regains focus, and the page shows the existing confirmation | Optional fields remain visibly optional; hidden sections reopen for errors |
| Fee Agreement | Save action shows `Saving...`; editor remains readable | Missing optional fees explains that none are selected without blocking core fees | Item or agreement errors appear beside the affected section and the early review shows warning count | Dialog closes and the current agreement/version history refreshes | Supersede changes, warnings, and incomplete billing configuration stay visible in the early summary |
| Outstanding fees | Heading and layout remain stable with an inline loading message | Explain `No outstanding fees for {year}` and keep permitted One-time Charge access visible | Inline alert appears in the outstanding-fee section with Refresh available | Fee groups and selection controls replace the state message | Previously selected allocations remain visible while a refresh runs or fails |
| Payment allocation | Record action shows `Saving...`; Cancel remains available | `Select an outstanding fee to continue` appears beside a zero-allocation balance state | Allocation errors appear in the allocation section and Additional details opens for its own errors | Dialog closes, payment history refreshes, and the page confirms the recorded amount/status | Balance explicitly shows `Balanced`, `Amount remaining`, or `Over-allocated`; record stays disabled until valid |
| Verify Payment | Verify action shows `Verifying...` | Not applicable because the trigger identifies one payment | Stale status or server validation appears below the summary and receives focus | Payment row refreshes to verified and a page confirmation appears | Existing values are prefilled; missing reference data is shown as `Not recorded` |
| Danger confirmations | Destructive action shows `Voiding...` or `Deleting...` and all duplicate actions are disabled | Not applicable because the target is required to open the dialog | Server failure stays in the dialog without losing the reason or target context | Dialog closes, affected history refreshes, and a page confirmation appears | Issued-receipt payment void becomes a non-actionable blocking state with explicit next step |
| Calendar Add/Edit/View | Save/Delete action shows an in-progress verb | Not applicable inside the form; fields remain visible | Form alert plus adjacent field errors; the first invalid field receives focus | Calendar updates in place, dialog closes, and trigger focus is restored when present | View-only state uses plain read-only presentation and a Close action |

No dialog clears user-entered values after a recoverable error. Loading and disabled states must remain readable without relying on opacity alone.

## User Journey and Emotional Arc

| Step | User does | Intended feeling | Design support |
| --- | --- | --- | --- |
| 1 | Opens a dialog from a row or page action | Oriented | Task title, one-sentence purpose, and target context are visible before fields |
| 2 | Scans what is required | Confident | Common-path fields and the result-driving work area appear before supporting metadata |
| 3 | Makes selections or enters details | In control | Sections, visible labels, inline totals, and progressive disclosure reduce memory load |
| 4 | Encounters an empty, invalid, or stale state | Recoverable | The relevant section explains what happened, preserves input, and exposes the next action |
| 5 | Reviews a total, balance, or consequence | Certain | Review summaries and danger context state the effect in plain language before submission |
| 6 | Submits | Reassured | One primary action, stable loading label, duplicate-submit protection, and visible Cancel |
| 7 | Returns to the page | Continuous | Focus returns to the trigger, refreshed data shows the result, and the page confirms success |

At five seconds, the dialog must answer task, target, and next action. Within five minutes, repeated finance work should be faster because optional metadata no longer blocks the core path. Over time, consistent placement and accurate consequences should make users trust that money, receipts, and calendar records will not be changed accidentally.

## Visual Direction and Design-System Alignment

This is task-focused application UI, not a marketing surface. The modal redesign keeps calm white surfaces, existing typography, restrained borders, and one brand accent. It does not add decorative gradients, card mosaics, ornamental icon circles, oversized radii, or animation.

Context summaries are compact information groups, not decorative cards. A warning or danger icon may appear only when it communicates status that is also written in text. Section headings describe the task area, such as `Outstanding fees`, `Payment allocation`, and `Additional payment details`.

Because the project has no `DESIGN.md`, new values must be limited to modal width/height, safe-margin, shadow, and danger-state tokens that cannot be expressed by the current variables. Reuse existing colors and radii wherever contrast and state clarity remain sufficient.

## Accessibility Requirements

- Dialog has `role="dialog"` and `aria-modal="true"`.
- Title and optional description have stable generated IDs.
- Focus is trapped and restored.
- The portal keeps the dialog outside the inert `#root`; background content is inert, `aria-hidden`, and scroll locked.
- Close has an explicit accessible name.
- Visible focus rings are not clipped by the dialog.
- All interactive targets are at least 44px on iPad.
- Body text and status text retain at least 4.5:1 contrast.
- Danger meaning is expressed by text and iconography, not color alone.
- Loading and success updates that do not move focus use an appropriate polite live region; errors use assertive alert semantics.
- Reduced-motion preferences are respected; no new required motion is added.
- Zoom to 200% does not introduce page-level horizontal scrolling.
- A 60-character student or event name, a long receipt number, and a multi-line server error wrap inside their own region without covering Close, actions, or adjacent values.

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
- `frontend/src/features/fee-agreements/FeeAgreementEditor.tsx`
- `frontend/src/features/fee-agreements/FeeAgreementEditor.css`
- `frontend/src/features/fee-agreements/FeeAgreementEditor.test.tsx`

Add one small `ModalContextSummary` component with default and danger tones. Reuse it for Verify Payment, Void Payment, Void Receipt, and Delete Calendar Event. No general component-library refactor is planned.

Use the same component or its neutral styling for the compact student context in Fee Agreement, One-time Charge, and Record Payment. It must render semantic text or a definition list, not layout-only divs.

## Verification

Automated:

- Modal focus trap cycles with Tab and Shift+Tab.
- Escape invokes close.
- Initial focus and focus restoration work.
- Description is associated through `aria-describedby`.
- Background scroll lock and inert state are added and removed.
- The modal is portaled outside `#root`, and unmount restores any prior root/body attributes and styles.
- Backdrop clicks do not close the dialog.
- Size and tone classes render correctly.
- Existing modal open/close and submission tests continue to pass.
- Copy and summary tests cover One-time Charge, Verify Payment, Void Payment, Void Receipt, and Calendar deletion.
- Form-error tests cover `aria-invalid`, `aria-describedby`, focus movement, and automatic expansion of hidden error sections.
- Void Payment tests cover verified, pending, and issued-receipt-blocked states; the blocked state has no enabled submit action.
- Calendar view-only tests expect `Close`, not `Cancel`, and no save affordance.
- Role-based tests cover school-admin creation dialogs and finance verification/void dialogs so every inventory item is exercised with a role that can actually open it.
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
- Footer visual, DOM, and keyboard order agree at every breakpoint.
- Record Payment shows fee selection or a clear fee-selection entry and balance status in the first screen.
- Fee Agreement shows total or review-summary access before the detailed iPad editor.
- Danger dialogs show the target, consequence, reason field, and distinct danger action.
- Void Payment cannot present an enabled confirmation while an issued receipt exists.
- User-facing `Manual Charge` copy is replaced by `One-time Charge` in the affected dialog and actions.
- Keyboard focus cannot escape an open dialog.
- Background scrolling and interaction are blocked while a dialog is open.
- Closing restores focus to the trigger.
- Existing finance, student, and calendar behavior is unchanged.
- Automated checks pass.
- PC and iPad browser QA passes with accepted screenshots.
- Any limitation requiring a real iPad device is documented rather than treated as verified.

## Design Review Scorecard

| Review pass | Before | After | Why it is not lower or higher |
| --- | ---: | ---: | --- |
| Information architecture | 7/10 | 9/10 | The shared scan order and workflow hierarchy are explicit; final visual proof waits for implementation screenshots |
| Interaction states | 5/10 | 9/10 | Loading, empty, error, success, and conditional states are now specified by feature group |
| User journey | 6/10 | 9/10 | The task arc covers orientation through recovery and return-to-page continuity |
| AI-slop risk | 8/10 | 9/10 | The plan now limits decoration and preserves the calm existing application language |
| Design-system alignment | 6/10 | 8/10 | Existing tokens and components are named, but the repository has no formal `DESIGN.md` |
| Responsive and accessibility | 7/10 | 9/10 | Breakpoints, portal isolation, focus, touch targets, error semantics, and action order are testable |
| Unresolved decisions | 6/10 | 10/10 | All modal-scope ambiguities found in review have a recorded resolution |

Overall design completeness moved from **7/10 to 9/10**. A 10/10 requires the implemented dialogs to pass comparison screenshots at every target viewport plus keyboard, 200% zoom, and real iPad Safari checks.

## Resolved Design Decisions

| Decision | Resolution |
| --- | --- |
| PC and iPad landscape overlap | PC begins at 1181px; iPad landscape is 1024–1180px |
| How to make the whole background inert | Portal the dialog to `document.body`, then isolate `#root` |
| Whether backdrop click closes forms | No; only explicit Close, Cancel, or Escape |
| Focus target | First meaningful field for forms, safe Cancel for danger, Close for read-only |
| Footer wrap order | DOM and visual order stay secondary then primary; both become full width when stacked |
| Payment supporting metadata | Collapsed by default, but opens for values, required fields, or validation errors |
| Void Payment with an issued receipt | Show a blocked explanation with no enabled submit; void the receipt first |
| Void Receipt consequence | Receipt voiding does not void the payment or change balances |
| Calendar view-only footer copy | Use `Close`, not `Cancel` |

There are no unresolved modal design decisions. There are no deferred modal-specific items to add to `TODOS.md`; real-device and browser checks are included in the implementation verification work rather than deferred.

## Implementation Tasks

Synthesized from this review's findings. Each task derives from a specific finding above.

- [ ] **T1 (P1, human: ~4h / Codex: ~25min)** — `ModalFrame` — Add portal rendering, focus containment, background isolation, scroll locking, description association, and safe cleanup.
  - Surfaced by: Responsive and accessibility review — inert background cannot be implemented correctly while the dialog remains inside `#root`.
  - Files: `frontend/src/components/AdminUi.tsx`, `frontend/src/components/AdminUi.test.tsx`
  - Verify: focused unit tests for portal, Tab/Shift+Tab, Escape, focus restore, inert, scroll lock, and backdrop behavior.
- [ ] **T2 (P1, human: ~3h / Codex: ~20min)** — Modal layout — Implement size/tone contracts, non-overlapping viewport ranges, dynamic-height rules, overflow cues, and modal-owned footer wrapping.
  - Surfaced by: Information architecture and responsive review — iPad clipping and page-level button rules currently break dialog layout.
  - Files: `frontend/src/components/AdminUi.css`, `frontend/src/App.css`
  - Verify: `npm.cmd run build` plus 1440×900, 1180×820, 820×1180, and 390×844 screenshots.
- [ ] **T3 (P1, human: ~6h / Codex: ~35min)** — Record Payment — Reorder the workflow, add student context, expose fee selection and balance early, and make supporting details conditionally collapsible.
  - Surfaced by: Information architecture and journey review — the current first screen hides the task that determines whether the payment is correct.
  - Files: `frontend/src/App.tsx`, `frontend/src/App.css`, `frontend/src/features/payments/PaymentAllocationEditor.tsx`, `frontend/src/App.test.tsx`
  - Verify: existing payment behavior tests plus first-screen and hidden-error regression tests.
- [ ] **T4 (P1, human: ~4h / Codex: ~25min)** — Fee Agreement — Add student context and an early compact iPad review summary while preserving the PC review panel.
  - Surfaced by: Information architecture and responsive review — iPad users currently reach totals and changes only after the detailed editor.
  - Files: `frontend/src/App.tsx`, `frontend/src/features/fee-agreements/FeeAgreementEditor.tsx`, `frontend/src/features/fee-agreements/FeeAgreementEditor.css`, related tests
  - Verify: create/supersede behavior tests and PC/iPad initial plus scrolled screenshots.
- [ ] **T5 (P2, human: ~4h / Codex: ~25min)** — Standard forms — Apply explicit sizes, iPad grids, initial focus, view-only copy, and One-time Charge terminology.
  - Surfaced by: Design-system and responsive review — standard forms use inconsistent naming and generic page breakpoints.
  - Files: `frontend/src/App.tsx`, `frontend/src/App.css`, `frontend/src/components/CalendarPage.tsx`, `frontend/src/components/CalendarPage.css`, related tests
  - Verify: Student, One-time Charge, and Calendar tests plus all target viewport screenshots.
- [ ] **T6 (P1, human: ~5h / Codex: ~30min)** — Financial confirmations — Add semantic context summaries, accurate consequences, danger focus, and the issued-receipt payment-void guard.
  - Surfaced by: Interaction-state and journey review — current confirmations omit the target and allow a known backend rejection path.
  - Files: `frontend/src/components/AdminUi.tsx`, `frontend/src/App.tsx`, `frontend/src/App.css`, `frontend/src/App.test.tsx`
  - Verify: verify/void role tests and pending, verified, issued-receipt, and voided-receipt cases.
- [ ] **T7 (P1, human: ~4h / Codex: ~25min)** — Error recovery — Associate field errors, focus the first failure, preserve values, and open hidden sections containing errors.
  - Surfaced by: Interaction-state and accessibility review — adjacent error text alone is not enough for keyboard and screen-reader recovery.
  - Files: all modal form components and their focused tests
  - Verify: automated `aria-invalid`, `aria-describedby`, alert focus, and scroll-into-view tests.
- [ ] **T8 (P1, human: ~6h / Codex: ~40min)** — Verification — Exercise every dialog with the correct permission role and capture accepted responsive evidence.
  - Surfaced by: All passes — the design is not complete until every inventory item is checked in its real state.
  - Files: `frontend/src/components/AdminUi.test.tsx`, `frontend/src/App.test.tsx`, `frontend/src/components/CalendarPage.test.tsx`, visual evidence outside production source
  - Verify: `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run build`, `git diff --check`, browser QA, keyboard QA, 200% zoom, and documented real-iPad limitations.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
| --- | --- | --- | ---: | --- | --- |
| CEO Review | `/plan-ceo-review` | Scope and strategy | 0 | — | Not run |
| Codex Review | `/codex review` | Independent second opinion | 0 | — | Not run |
| Eng Review | `/plan-eng-review` | Architecture and tests (required) | 0 | REQUIRED | Portal, focus, and responsive implementation still need engineering review |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | Score 7/10 → 9/10; 9 decisions resolved |
| DX Review | `/plan-devex-review` | Developer-experience gaps | 0 | — | Not run |

**VERDICT:** Design review is clear. Engineering review is required before implementation because the portal, focus-management, and responsive layout changes affect shared infrastructure.

NO UNRESOLVED DECISIONS
