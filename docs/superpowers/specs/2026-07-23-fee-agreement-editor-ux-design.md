# Fee Agreement Editor UX Design

**Date:** 2026-07-23  
**Status:** Approved for implementation planning

## Purpose

Make the Student detail `Create Fee Agreement` and `Supersede Fee Agreement` workflows faster to scan, easier to learn, and less error-prone on a PC. Mobile remains supported, but desktop is the primary interaction target.

The usual workflow configures only Tuition and Misc. Optional fee items are used less often. Superseding an agreement must clearly explain how the draft differs from the current agreement.

## Problems to Solve

The current editor presents every enabled fee item as a large, fully expanded form. This creates several problems:

- The modal is taller than the viewport and requires excessive scrolling.
- Common fields and low-frequency settings have equal visual weight.
- Empty month controls look incomplete even when an empty monthly override means every month.
- Optional fees occupy attention before the user needs them.
- Create and Supersede look almost identical.
- A user cannot review the total or Supersede changes while editing content farther up the form.
- Validation inside a collapsed or distant area can be hard to locate.

## Design Principles

1. **Optimize the common path.** Tuition and Misc are ready to review immediately.
2. **Show the result before the controls.** Each fee row summarizes its current configuration when collapsed.
3. **Reveal complexity on demand.** Advanced billing and month controls remain available without dominating the default view.
4. **Use plain language.** Controls explain their effect without relying on hidden tooltips.
5. **Keep consequences visible.** Totals, dates, warnings, and Supersede changes remain visible beside the editor on desktop.
6. **Preserve existing business behavior.** The redesign reuses the current API payload, enums, validation, and permissions.

## Desktop Layout

The financial modal uses a maximum desktop width of approximately `1180px` and retains the existing fixed header, independently scrolling body, and fixed footer.

Inside the body, the Fee Agreement editor uses two columns:

- A flexible main editor column for agreement details and fee configuration.
- An approximately `300px` sticky review column for totals, agreement coverage, warnings, and Supersede changes.

The main column contains these sections in order:

1. Agreement details
2. Core fees
3. Optional fees
4. Manual discount

At narrower desktop and tablet widths, the layout becomes one column and the review panel follows the editor. On mobile, the modal becomes a near-full-height single-column workflow with at least `44px` touch targets.

## Agreement Details

The top of the main column uses a compact field grid:

- Academic Year appears only in Create mode, matching current behavior.
- Payment Plan
- Effective From
- Effective To
- Agreement Remarks

Remarks use a shorter default height and grow only when needed. Validation remains immediately below its associated field.

Supersede mode includes a compact context banner identifying the current version and explaining that submitting creates a new version while preserving history.

## Core Fee Rows

Tuition and Misc are always visible as compact rows. Each collapsed row shows:

- Fee name and mandatory status
- Amount
- Charge Type
- Billing Pattern
- Human-readable month summary
- Preview confirmation status
- An explicit `Edit` or expand control

The summary should read naturally, for example:

`Monthly · Every month · No preview required`

Only one fee row is expanded by default at a time. Expanding a row reveals:

- Charge Type
- Billing Pattern
- Preview confirmation
- Month customization
- Any fee-specific validation

Amount remains editable from the compact row because it is the most frequently changed value.

## Month Interaction

For a monthly fee with no month override, the editor displays `Every month`. It does not render twelve empty month controls.

The user can choose `Customize months` to reveal:

- Twelve selectable month buttons
- `Select all`
- `Clear`
- `Use every month`

For a `Custom` billing pattern, the month controls open automatically and at least one month is required. One-time billing continues to use the current business rules and defaults.

Selected, unselected, hover, focus, and error states remain visually distinct and keyboard accessible.

## Optional Fees

Disabled optional fees do not render as full editor cards. They appear behind an `Add optional fee` control.

The optional fee picker:

- Lists only fee items not already enabled.
- Supports quick filtering when the list is long.
- Shows the fee name and default amount when available.
- Adds the selected fee to the main editor and opens it for review.

Enabled optional fees use the same compact row and expanded editor as Tuition and Misc. A removable optional fee returns to the picker without deleting any backend data because the draft has not yet been submitted.

## Manual Discount

Manual Discount is collapsed by default and displays `No manual discount` in its summary state.

When enabled, the existing fields remain available:

- Discount Label
- Discount Type
- Scope
- Value
- Discount Remark
- Selected Fee Items when the selected-item scope is used

The review panel updates its Discount and Total values immediately.

## Review Panel

The desktop review panel remains sticky within the modal body and contains:

- Subtotal
- Manual Discount
- Preview Total
- Effective date range
- Number and names of enabled fees
- Validation or completeness warnings

Create mode uses the heading `Agreement Summary`.

Supersede mode uses `Changes from v{current version}` and lists meaningful differences in plain language:

- Amount changes, such as `Tuition: RM 800 → RM 850`
- Month changes, such as `Misc: Every month → Jan–Jun`
- Added fees
- Removed optional fees
- Charge Type, Billing Pattern, or preview-confirmation changes
- Discount changes
- Effective date changes

Unchanged fields are not listed. When no fee, billing, or discount configuration has changed, the panel says `No fee configuration changes` and still shows the effective-date change separately. The redesign does not add a new rule that blocks an otherwise valid Supersede submission.

## Footer and Submission

The footer retains secondary Cancel and primary submit actions.

Primary labels are:

- `Create Agreement`
- `Supersede Agreement`
- `Saving…` during submission

The primary action is disabled while saving or while known required validation is unresolved. Existing backend rules remain authoritative; the redesign does not add a new no-change submission rule.

Closing with Cancel, the close button, or Escape checks for unsaved changes. If the draft differs from its initial state, the user must confirm that the changes should be discarded. A clean form closes immediately.

## Validation and Error Recovery

Existing server validation remains authoritative.

When a submission receives validation errors:

1. The editor maps errors to their agreement or fee section.
2. Any affected collapsed fee or discount section opens automatically.
3. The first invalid control receives focus.
4. The review panel shows a concise warning and the number of areas needing attention.
5. Each detailed error remains next to the relevant control.

Errors never appear only in the review panel.

## Component Boundaries

The existing `ModalFrame` remains the shell. Fee Agreement UI is extracted from the large `App.tsx` render block into focused components:

- `FeeAgreementEditor` owns form layout and submission coordination.
- `AgreementDetailsSection` renders agreement-level fields.
- `FeeItemRow` renders the compact summary and expanded editor for one fee.
- `BillingMonthSelector` owns Every month and custom-month interaction.
- `OptionalFeePicker` adds disabled fee items to the draft.
- `AgreementDiscountEditor` renders the collapsed discount workflow.
- `AgreementReviewPanel` renders totals and mode-specific review content.

Pure helpers derive:

- Fee-row summaries
- Month summaries
- Whether a form is dirty
- Supersede differences
- The first section containing a validation error

Form state can remain owned by `App.tsx` during the initial extraction if moving state would add unnecessary risk. Components receive explicit values and callbacks rather than duplicating business state.

## Data Flow

No backend, database, permission, enum, or payload changes are required.

Create continues to submit to:

`POST /students/{student}/fee-agreements`

Supersede continues to submit to:

`POST /fee-agreements/{agreement}/supersede`

The editor derives its summaries and differences from the existing `FeeAgreementForm`, current `FeeAgreement`, and fee-item definitions. The submitted payload retains the existing field names and representations, including the current empty-month meaning for an unmodified monthly schedule.

## Accessibility

- Every input retains a persistent visible label.
- Collapsible fee rows expose expanded state and an accessible control name.
- Month buttons are keyboard operable and announce selection.
- Focus is moved only for opening a requested editor or recovering from validation.
- The existing modal Escape and focus-return behavior remains.
- Color is not the only signal for selection, errors, additions, or removals.

## Responsive Behavior

The product is PC-first.

- At wide desktop sizes, use the two-column editor and sticky review panel.
- At intermediate widths, use one column and place the review panel after the editor.
- On mobile, use a near-full-height modal, one field per row where necessary, wrapping month controls, and full-width footer actions.
- Mobile support must remain functional and readable, but it does not determine the desktop information architecture.

## Testing

Add frontend tests before implementation for:

1. Create opens with compact Tuition and Misc rows.
2. Editing a fee expands its advanced controls.
3. Monthly with no override displays `Every month`.
4. Customizing months reveals selectable months and bulk actions.
5. Custom billing requires at least one selected month.
6. Adding an optional fee inserts and opens its row.
7. Manual Discount is collapsed by default and updates totals when enabled.
8. Supersede lists amount, month, added, removed, and discount changes.
9. Supersede clearly reports when only the effective date changes and does not invent a new no-change blocking rule.
10. Validation opens the affected section and focuses the first invalid control.
11. A dirty form asks before closing, while a clean form closes directly.
12. Create and Supersede continue to submit the existing payload shape.

Run the targeted Vitest tests during development, followed by the full frontend test suite, lint, and production build.

## Visual Verification

Verify both modes with seeded data at:

- Wide desktop
- Narrow desktop
- Mobile fallback

The final desktop review must confirm:

- Tuition and Misc are understandable without expanding them.
- Every month is unambiguous.
- Optional fees do not dominate the default screen.
- Totals and Supersede changes remain visible while editing.
- The common Create path requires materially less scrolling.
- The primary action and validation state are easy to find.

## Out of Scope

- Backend or database changes
- New fee types, billing enums, or discount rules
- Redesigning Student detail outside the Fee Agreement workflow
- Changing the meaning of existing payload fields
- Replacing the shared modal system for unrelated workflows
