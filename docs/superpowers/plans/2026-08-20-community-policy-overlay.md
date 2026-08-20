# Community Policy Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the mandatory policy modal above the real home screen while making the complete App shell inert until acceptance.

**Architecture:** `App.tsx` always renders the authenticated shell and places `CommunityPolicyGate` beside it as the top modal layer. The shell receives native `inert` and `aria-hidden` while locked; the existing gate continues to own API state and acceptance.

**Tech Stack:** React 19, TypeScript 6, CSS, Vitest, Testing Library

## Global Constraints

- Keep the real role-specific home screen visible behind the modal.
- Block mouse, touch, focus, and keyboard access until acceptance.
- Reuse existing App color, radius, border, and shadow tokens.
- Do not add dependencies or change backend behavior.

---

### Task 1: Place the gate above an inert App shell

**Files:**
- Modify: `app/src/App.tsx`
- Test: `app/src/App.test.tsx`

**Interfaces:**
- Consumes: `CommunityPolicyGate({ role, onReadyChange })`
- Produces: authenticated shell wrapper with `data-testid="authenticated-app-shell"`

- [x] **Step 1: Change the unaccepted-user test**

Assert the modal and navigation both render, and assert the shell wrapper has `inert` plus `aria-hidden="true"`.

- [x] **Step 2: Run the focused test and confirm it fails**

Run: `npm.cmd test -- --run src/App.test.tsx`

Expected: FAIL because the current separate policy page does not render the navigation behind it.

- [x] **Step 3: Render and lock the shell**

Remove the early policy-screen return. Wrap `MobileShell` in a sibling container and apply:

```tsx
<div
  data-testid="authenticated-app-shell"
  inert={policiesAccepted ? undefined : true}
  aria-hidden={policiesAccepted ? undefined : true}
>
  <MobileShell>{/* existing role view */}</MobileShell>
</div>
{!policiesAccepted && <CommunityPolicyGate role={activeRole} onReadyChange={setPoliciesAccepted} />}
```

- [x] **Step 4: Run the focused test and confirm it passes**

Run: `npm.cmd test -- --run src/App.test.tsx`

Expected: all App tests pass.

### Task 2: Align the modal with the App design system

**Files:**
- Modify: `app/src/features/community-safety/CommunitySafety.css`
- Test: `app/src/features/community-safety/CommunitySafety.test.tsx`

**Interfaces:**
- Consumes: existing policy-gate class names
- Produces: compact responsive modal and restrained policy rows

- [x] **Step 1: Restyle the existing classes**

Use a lighter overlay, warm-white compact card, burgundy accent, simple checkbox rows, readable inline policy titles, and a full-width brand action. Keep the detail view scrollable and preserve 16px mobile margins.

- [x] **Step 2: Run focused safety tests**

Run: `npm.cmd test -- --run src/features/community-safety/CommunitySafety.test.tsx`

Expected: all Community safety tests pass.

- [x] **Step 3: Run proportional verification**

Run: `npm.cmd run lint` and `npm.cmd run build`.

Expected: both commands exit 0.

- [x] **Step 4: Commit**

Stage only the App overlay implementation, tests, CSS, and this plan; commit with `fix: integrate policy gate with app home`.
