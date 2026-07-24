# Record Payment Charge Allocation UX Design

**Date:** 2026-07-24  
**Status:** Approved for implementation

## Context

The Record Payment modal currently offers two allocation paths:

1. Select an outstanding Fee Record charge cell.
2. Add a manual allocation that records money without clearing any Fee Record outstanding balance.

The second path is visually prominent and uses terminology that is easy to confuse with adding an ad-hoc student charge. Users who need to collect payment for uniforms, CCA activities, books, or another one-time item may incorrectly choose manual allocation even though those payments should clear a real charge.

The intended accounting model remains:

- A school charge is created first.
- A payment is allocated to that charge.
- An unclassified payment allocation is an exception and does not reduce outstanding balances.

## Goals

- Make the normal payment flow understandable without accounting knowledge.
- Let a user add a missing one-time charge without leaving Record Payment.
- Automatically select a newly created one-time charge for payment.
- Make the effect of unclassified payments explicit and difficult to use accidentally.
- Keep the first version generic so Uniform and CCA variants can be configured later.
- Preserve the existing Fee Record and payment allocation accounting behavior.

## Non-goals

- Building a Uniform product catalogue, sizes, stock, or variants.
- Building a CCA activity catalogue, enrolment, schedules, or pricing rules.
- Changing payment verification or receipt behavior.
- Changing the Fee Agreement editor.
- Automatically deciding which outstanding item a payment should clear.

## Terminology

User-facing copy will avoid using “manual” for two different concepts:

| Current term | New user-facing term | Meaning |
| --- | --- | --- |
| Manual Charge | One-time charge | A real student charge, such as Uniform or CCA, that can be paid and cleared |
| Manual allocation | Unclassified payment | Money recorded without linking it to a charge; outstanding balances remain unchanged |
| Outstanding Charge Cells | Outstanding fees | Unpaid items the user can select |
| Selected Allocations | Payment allocation | Fees this payment will clear |

Internal API values such as `manual` and `charge` remain unchanged.

## Primary User Flow

1. User opens Record Payment.
2. The modal loads the student’s outstanding fees for the selected academic year.
3. User selects one or more fees such as Tuition, Uniform, or CCA.
4. Each selected fee appears in Payment allocation with an editable amount.
5. The total payment amount follows the selected allocations.
6. User records the payment.
7. Cash clears the selected charge balances immediately; non-cash payments clear them after finance verification, matching current behavior.

## Add a Missing One-time Charge

The outstanding-fees section includes a secondary `+ Add one-time charge` action.

Activating it reveals a compact inline form in the Record Payment modal with:

- Billing month
- Category
- Description
- Amount
- Optional remark

Academic year is inherited from the payment form. The first version uses the existing Fee Record categories and free-text description. Examples may mention Uniform, CCA, Books, or Other, but these are not fixed choices.

On successful creation:

1. The new Fee Record charge is saved using the existing manual-charge API.
2. Outstanding fees are refreshed.
3. The new charge is automatically selected.
4. Its amount is included in the payment total.
5. The inline form closes and a success message confirms that the charge was added.

If creation fails, validation appears inside the inline form and no payment allocation is added.

## Unclassified Payment Exception

The current prominent `Add manual allocation` action moves into a collapsed `Advanced options` area below the normal allocation flow.

The action is renamed:

`Record unclassified payment`

Before adding the first row, the UI explains:

> Use only when received money cannot be linked to a fee. This records the payment but does not reduce the student’s outstanding balance.

The unclassified row uses:

- Description
- Amount
- Remove icon/button

Only one empty unclassified row may exist at a time. The add action is disabled while an existing unclassified row is incomplete. This prevents repeated accidental blank cards.

The row is visually compact and clearly marked with an exception/warning treatment. It is not styled like a primary action.

## Desktop-first Layout

The modal remains desktop-first with responsive fallback:

- Outstanding fees and payment allocation remain easy to scan at common PC widths.
- One-time charge fields use a compact multi-column layout on desktop.
- Allocation rows place description, context, amount, and remove action on one line where space allows.
- Narrow screens stack fields without horizontal scrolling.
- The sticky footer continues to expose Cancel and Record Payment.

## Validation and Guardrails

- Payment must contain at least one charge allocation or unclassified allocation.
- Payment total must equal allocation total.
- Allocation amount must be greater than zero.
- A charge allocation cannot exceed its current outstanding amount.
- An unclassified payment requires a description.
- A one-time charge amount must be greater than zero.
- Billing month must belong to the selected academic year.
- Creating a one-time charge requires existing Fee Record management permission.
- Users without that permission do not see `+ Add one-time charge`.
- Changing academic year retains the current existing behavior for allocations; implementation should additionally avoid silently carrying a newly created charge into the wrong year.

## Extensibility

Uniform types, CCA activities, and other structured offerings will later be introduced as configurable fee items or catalogues. The one-time charge form deliberately stores the existing category, description, amount, and optional fee-item identity so future catalogue selections can populate the same charge model without redesigning payment allocation.

Until those catalogues exist:

- Uniform, books, and CCA can use category `OTHERS`.
- The description identifies the item, for example `Uniform – Sports T-shirt` or `CCA – Basketball`.
- Recurring CCA fees should continue to be configured as optional Fee Agreement items rather than recreated every payment.

## Error Handling

- Outstanding-fee loading errors remain visible near the picker.
- One-time charge API validation stays inside its inline form.
- Payment validation stays beside the affected allocation and in the existing modal error summary.
- A created charge is never presented as selected until the server confirms creation.
- If refreshing outstanding fees fails after creation, the UI reports that the charge was created but could not be loaded and does not fabricate a local allocation.

## Testing

Frontend tests will cover:

- The normal outstanding-fee selection flow.
- Opening and cancelling the one-time charge form.
- Creating a one-time charge and automatically selecting it.
- Permission-based visibility of the action.
- Validation failures in the inline form.
- Advanced options disclosure and warning copy.
- Prevention of multiple incomplete unclassified rows.
- Compact allocation rendering and removal.
- Payment/allocation total balancing.

Existing backend tests for manual Fee Record charges, payment allocation, verification, and charge balance updates remain the source of truth for accounting behavior. No backend schema change is required for this version.
