# MIS App Mobile Liquid Glass Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a calmer, modern phone-first MIS App with role-specific floating Liquid Glass navigation and reduced visual density while preserving all existing role, API, Attendance, and Finance behavior.

**Architecture:** Keep the existing React role shell and view components, but make the shell responsible only for compact global chrome and role-specific navigation. Pass logout into each role's More view, simplify feed markup, and consolidate the visual system in `MobileShell.css` using opaque content surfaces plus progressive-enhancement glass tokens for overlays only.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Lucide React, CSS, Vitest, Testing Library, Oxlint.

## Global Constraints

- Preserve the existing `AppRole`, role gates, API calls, Attendance behavior, Parent Finance behavior, and backend authorization.
- Do not add a UI framework, animation package, authentication package, or native dependency.
- Parent Finance remains read-only and Student Finance remains absent.
- Glass is reserved for persistent navigation/header overlays; content remains primarily opaque.
- Support 360×800, 390×844, and 430×932 without horizontal scrolling or clipped navigation.
- Every interactive target is at least 44px and icon-only navigation retains an accessible name.
- Respect `prefers-reduced-motion` and provide an opaque fallback when `backdrop-filter` is unavailable.

---

### Task 1: Role-Aware Floating Navigation Shell

**Files:**
- Modify: `app/src/components/MobileShell.test.tsx`
- Modify: `app/src/components/MobileShell.tsx`
- Modify: `app/src/components/MobileShell.css`

**Interfaces:**
- Consumes: `AppRole`, `activeTab`, `onTabChange`, `allowedRoles`, `onRoleChange`, `userName`, and `environment`.
- Produces: `navByRole` rendered as five `.glass-nav-item` buttons; the active item exposes `.glass-nav-label` while inactive labels remain screen-reader accessible.

- [ ] **Step 1: Write failing shell tests**

Add assertions proving Parent, Student, Teacher, and Staff render only their own destination names, the active item has `aria-current="page"`, inactive items retain `aria-label`, and the header no longer exposes Logout.

```tsx
expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
expect(screen.getByRole('button', { name: 'Finance' })).not.toHaveAttribute('aria-current')
expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument()
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm.cmd test -- --run src/components/MobileShell.test.tsx`

Expected: FAIL because the current full-width navigation has no `aria-current` contract and the header still contains Logout.

- [ ] **Step 3: Implement compact shell markup**

Remove `LogOut` from the header, give every navigation button its label as `aria-label`, give the active item `aria-current="page"`, and render the label as:

```tsx
<span className="glass-nav-icon">{item.icon}</span>
<span className={activeTab === item.id ? 'glass-nav-label' : 'sr-only'}>{item.label}</span>
```

Use the role name/environment in a compact `.mis-app-context` block and preserve role switching.

- [ ] **Step 4: Implement progressive-enhancement Liquid Glass CSS**

Define glass tokens and a centered floating capsule:

```css
:root {
  --glass-surface: rgba(255,255,255,.78);
  --glass-border: rgba(255,255,255,.82);
  --glass-shadow: 0 18px 48px rgba(23,32,51,.18);
}
.mis-bottom-nav {
  position: fixed;
  inset-inline: 14px;
  bottom: max(12px, env(safe-area-inset-bottom));
  margin-inline: auto;
  max-width: 520px;
  border-radius: 30px;
  background: var(--glass-surface);
}
@supports (backdrop-filter: blur(1px)) {
  .mis-bottom-nav { backdrop-filter: blur(24px) saturate(160%); }
}
```

Use a five-column grid where the active column expands using `grid-template-columns` derived from `data-active-index`, or use flex with an active item `flex-grow`; it must remain stable at 360px.

- [ ] **Step 5: Run focused shell tests**

Run: `npm.cmd test -- --run src/components/MobileShell.test.tsx`

Expected: all shell/view tests pass.

- [ ] **Step 6: Commit the shell**

```powershell
git add app/src/components/MobileShell.tsx app/src/components/MobileShell.css app/src/components/MobileShell.test.tsx
git commit -m "feat: add role-aware liquid glass navigation"
```

### Task 2: Move Logout Into Role Profile Pages

**Files:**
- Modify: `app/src/App.tsx`
- Modify: `app/src/components/ParentPortalView.tsx`
- Modify: `app/src/components/StudentPortalView.tsx`
- Modify: `app/src/components/TeacherPortalView.tsx`
- Modify: `app/src/components/MobileShell.test.tsx`

**Interfaces:**
- Consumes: `onLogout: () => void` passed by `App` to each role view.
- Produces: a `.logout-action` in `ParentMore`, `StudentMore`, and `TeacherMore`/Staff More.

- [ ] **Step 1: Write failing More-page logout tests**

Render each role view with `activeTab="more"`, provide a spy, click `Sign out`, and assert it is called exactly once.

```tsx
const logout = vi.fn()
render(<StudentPortalView studentName="Alyssa Tan" activeTab="more" onLogout={logout} />)
fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
expect(logout).toHaveBeenCalledTimes(1)
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm.cmd test -- --run src/components/MobileShell.test.tsx`

Expected: FAIL because the role views do not accept `onLogout`.

- [ ] **Step 3: Pass logout through `App` and role views**

Update each exported view signature to accept `onLogout`, pass it to the corresponding More component, and render:

```tsx
<button type="button" className="logout-action" onClick={onLogout}>
  <LogOut />
  <span><strong>Sign out</strong><small>End this session on this device</small></span>
</button>
```

Remove `onLogout` from `MobileShell` because shell chrome no longer owns it.

- [ ] **Step 4: Run focused tests**

Run: `npm.cmd test -- --run src/components/MobileShell.test.tsx src/App.test.tsx`

Expected: all selected tests pass.

- [ ] **Step 5: Commit profile actions**

```powershell
git add app/src/App.tsx app/src/components/ParentPortalView.tsx app/src/components/StudentPortalView.tsx app/src/components/TeacherPortalView.tsx app/src/components/MobileShell.test.tsx app/src/App.test.tsx
git commit -m "feat: move app logout into profile pages"
```

### Task 3: Reduce Feed Density and Modernize Content Surfaces

**Files:**
- Modify: `app/src/components/CommunityFeed.tsx`
- Modify: `app/src/components/MobileShell.css`
- Modify: `app/src/components/MobileShell.test.tsx`

**Interfaces:**
- Consumes: existing `CommunityFeedProps` and local sample-post state.
- Produces: `.feed-post`, `.feed-post-meta`, `.feed-media`, `.context-card`, and `.preview-note` with reduced repeated chrome.

- [ ] **Step 1: Add structural feed tests**

Assert the feed retains audience scope, preview status, reaction controls, and the appropriate Parent or Teacher contextual action.

```tsx
expect(screen.getByText('Class MB1')).toBeInTheDocument()
expect(screen.getByRole('button', { name: /Appreciate/ })).toBeInTheDocument()
expect(screen.getByText(/Preview/)).toBeInTheDocument()
```

- [ ] **Step 2: Run the focused feed tests**

Run: `npm.cmd test -- --run src/components/MobileShell.test.tsx`

Expected: existing behavior passes; new structural class assertions fail until markup changes.

- [ ] **Step 3: Simplify feed markup**

Combine author metadata and audience into a compact header, reduce preview wording to `Preview · community publishing is not connected`, preserve all buttons, and make media follow the copy without extra nested card framing.

- [ ] **Step 4: Restyle the feed for phone rhythm**

Use 20px gutters, 26px section gaps, 22px post radius, large media with `aspect-ratio`, a quiet action row, and one contextual action surface. Remove unnecessary left borders and repeated outlines.

- [ ] **Step 5: Run the focused tests and build**

Run: `npm.cmd test -- --run src/components/MobileShell.test.tsx; npm.cmd run build`

Expected: tests and TypeScript/Vite build pass.

- [ ] **Step 6: Commit feed redesign**

```powershell
git add app/src/components/CommunityFeed.tsx app/src/components/MobileShell.css app/src/components/MobileShell.test.tsx
git commit -m "feat: simplify mobile community feed"
```

### Task 4: Apply the Mobile Surface System Across Record Pages

**Files:**
- Modify: `app/src/components/MobileShell.css`
- Modify only where semantic hooks are required: `app/src/components/ParentPortalView.tsx`
- Modify only where semantic hooks are required: `app/src/components/StudentPortalView.tsx`
- Modify only where semantic hooks are required: `app/src/components/TeacherPortalView.tsx`

**Interfaces:**
- Consumes: all existing view class names and backend-connected Attendance/Finance state.
- Produces: consistent page gutters, surface hierarchy, row separators, safe-area clearance, loading/empty/error presentation, and responsive attendance controls.

- [ ] **Step 1: Capture baseline behavior with the full App test suite**

Run: `npm.cmd test -- --run`

Expected: all tests pass before record-page styling changes.

- [ ] **Step 2: Introduce shared surface and spacing tokens**

Add exact tokens for `--space-page: 20px`, `--surface-radius: 22px`, `--row-radius: 16px`, `--nav-clearance: 118px`, and phone-safe layout. Use them across `.record-page`, titles, summaries, rows, forms, and empty states.

- [ ] **Step 3: Reduce card-on-card styling**

Keep one prominent surface for balances/progress/Quiz callouts; turn result, receipt, class, setting, and subject groups into quiet lists with separators. Maintain semantic colors and 44px controls.

- [ ] **Step 4: Make Teacher Attendance usable at 360px**

At narrow widths, place the student identity on its own row and retain four 36–40px status controls without overflow. Preserve accessible labels and the correction-reason workflow.

- [ ] **Step 5: Add safe-area and reduced-motion rules**

Ensure `.mis-app-main` includes `padding-bottom: calc(var(--nav-clearance) + env(safe-area-inset-bottom))`; remove nonessential transitions/animations under `prefers-reduced-motion`.

- [ ] **Step 6: Run App tests, lint, and build**

```powershell
npm.cmd test -- --run
npm.cmd run lint
npm.cmd run build
```

Expected: 0 failing tests, Oxlint exit 0, and Vite production build exit 0.

- [ ] **Step 7: Commit record-page styling**

```powershell
git add app/src/components/MobileShell.css app/src/components/ParentPortalView.tsx app/src/components/StudentPortalView.tsx app/src/components/TeacherPortalView.tsx
git commit -m "feat: reduce mobile app visual density"
```

### Task 5: Documentation and Visual QA

**Files:**
- Modify: `DESIGN.md`
- Modify: `docs/current-status.md`
- Modify: `docs/mobile-app-product-spec.md`

**Interfaces:**
- Consumes: rendered App and the approved design spec.
- Produces: current design-system documentation and recorded verification evidence.

- [ ] **Step 1: Update canonical design documentation**

Document the active-expanded Liquid Glass capsule, compact header, overlay-only glass rule, phone gutters, safe-area clearance, and More-page logout.

- [ ] **Step 2: Start the local backend and App**

Run the existing local launch commands from `README.md`, keeping the backend on its configured local port and App on `5174`.

- [ ] **Step 3: Inspect representative phone screens**

Using the repository browser QA workflow, inspect Parent Home, Student Learn, Student Quiz, Teacher Attendance, Staff Home, Staff Review, and all role More pages at 360×800, 390×844, and 430×932.

Expected: no horizontal overflow; navigation is fully visible; only the active item shows a visible label; final content clears the floating capsule; long names truncate without hiding controls.

- [ ] **Step 4: Fix visual defects and repeat inspection**

Keep fixes limited to the approved visual system and repeat the affected viewport until the acceptance criteria pass.

- [ ] **Step 5: Run regression checks**

```powershell
Set-Location app
npm.cmd test -- --run
npm.cmd run lint
npm.cmd run build
Set-Location ..\frontend
npm.cmd test -- --run
npm.cmd run lint
npm.cmd run build
```

Expected: App and Admin tests/builds pass; only documented pre-existing Admin Fast Refresh warnings may remain.

- [ ] **Step 6: Review and commit documentation/fixes**

```powershell
git diff --check
git status --short
git diff --stat
git add DESIGN.md docs/current-status.md docs/mobile-app-product-spec.md app/src
git commit -m "docs: record mobile glass navigation redesign"
```

### Task 6: Synchronize, Merge, and Push Master

**Files:**
- No source changes expected; Git history and remote refs only.

**Interfaces:**
- Consumes: clean, verified `feature/split-admin-mobile-app` and latest `origin/master`.
- Produces: pushed feature branch and an explicit merge commit on `master` containing the verified redesign.

- [ ] **Step 1: Confirm clean state and fetch remote**

```powershell
git status --short
git fetch origin --prune
```

Expected: clean worktree; fetch succeeds.

- [ ] **Step 2: Integrate latest remote master into the feature branch**

```powershell
git merge --no-edit origin/master
```

Expected: merge succeeds or conflicts are resolved without discarding either side.

- [ ] **Step 3: Re-run App tests/build after integration**

Run: `Set-Location app; npm.cmd test -- --run; npm.cmd run build`

Expected: all tests and build pass on the integrated branch.

- [ ] **Step 4: Push the feature branch**

Run: `git push -u origin feature/split-admin-mobile-app`

Expected: remote feature ref points to the verified branch HEAD.

- [ ] **Step 5: Merge into local master with an explicit merge commit**

```powershell
git switch master
git merge --no-ff feature/split-admin-mobile-app -m "merge: mobile community app foundation"
```

Expected: `master` contains an explicit merge commit.

- [ ] **Step 6: Push master and verify refs**

```powershell
git push origin master
git status --short
git log -3 --oneline --decorate
```

Expected: `master` and `origin/master` point to the same merge commit and the worktree is clean.
