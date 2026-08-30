# School Updates Design

**Status:** Implemented on the local `feat/school-updates` branch and locally verified on 2026-08-24. Disposable MariaDB audience-query behavior and browser/manual UAT remain **Not verified**.

## Goal

Replace the social-media-style Community experience with a controlled School Updates feed. Authorized employees publish official text and image updates to the whole school or selected classes. Teacher, Parent, and Student recipients can read and Like posts, but cannot comment or publish unless the employee has the explicit publishing ability.

This change deliberately narrows the existing Community module instead of creating a separate Announcements module. Existing audience, media, reaction, report, moderation, tenant, school-scope, and audit foundations remain reusable.

## Product Positioning

- Rename the user-facing Community feed to **Updates** or **School Updates**.
- Treat posts as official school or class updates, not open social content.
- Do not provide comments, direct messages, user discovery, user blocking, public profiles, or Student/Parent publishing.
- Continue using the existing RYLAY App and Admin design language.

## Roles and User Abilities

The backend remains authoritative. Frontend visibility is only a usability control.

- `community.view`: view Updates within the authenticated user's resolved audience.
- `community.publish`: create official Updates and edit or withdraw one's own Updates.
- `community.moderate`: manage all school Updates and their reports. The Admin label becomes **Manage posts**.

The Employees editor presents the user-friendly labels **View posts**, **Publish posts**, and **Manage posts**. School Admin, Finance, and Teacher positions may receive publishing or management through their position defaults or explicit school-scoped User Ability overrides.

Only active employees with effective `community.publish` may create posts. Parent and Student identities never gain publishing merely from their App persona. School actors cannot grant cross-school or platform access, and all User Ability changes retain their existing required reason and transactional audit behavior.

## Publishing Flow

An authorized employee creates a post with:

- required text;
- optional multiple images;
- no video, document attachment, external-link preview, or comment setting;
- an audience of either **Whole school** or one or more selected classes;
- a **Notify audience** checkbox that defaults to enabled.

Whole-school and class selection are mutually exclusive. Class selection supports multiple classes. The composer displays a pre-publish summary such as `MA1, MB1 · Students, Parents and Teachers` and, when available, the estimated unique recipient count.

Authorized posts publish immediately. They do not enter `pending_review`. Basic existing text and image safety inspection remains as an upload-error safeguard, not as a routine approval queue.

## Audience Resolution

Tenant and school are resolved from the verified hostname and active membership before audience evaluation. Client-submitted tenant or school identifiers are never authoritative.

A whole-school post is visible to every active App user in the resolved school with effective view access.

A class-targeted post is visible to the union of:

- active Students currently enrolled in any selected class;
- active Parents/Guardians with an active reviewed relationship to a selected-class student;
- active Teachers currently assigned to any selected class;
- same-school employees with effective `community.moderate` for management purposes.

Recipients are deduplicated. A Parent linked to multiple targeted children receives one feed item and at most one notification. A user with multiple valid personas also receives one notification row.

Publishing to a valid empty class is allowed, but the composer warns that the current resolved audience is empty or incomplete. Invalid, inactive, or cross-school class IDs are rejected by the backend.

## Reading and Likes

Teacher, Parent, and Student use one Updates feed. Every recipient sees only posts within their resolved tenant, school, and audience.

Each card contains:

- author and publication time;
- audience label;
- body text and images;
- Like state and total Like count;
- Report action when the viewer is not already managing the post.

Every authorized viewer may Like or unlike a visible post. Each user contributes at most one Like. Likes contain no free text and require no moderation. The UI contains no comment button, comment count, comment editor, or historical comment display.

## Editing, Withdrawal, Reports, and Audit

- An author with effective publishing access may edit or withdraw their own post.
- A user with effective `community.moderate` may edit or withdraw any same-school post and manage Post Reports.
- Withdrawal is logical/soft removal. Posts, media references, actor, reason, timestamps, reports, and audit history remain preserved.
- Publishing, editing, withdrawing, report decisions, and publishing/management ability changes write Audit Trail records.
- Parent, Student, and Teacher recipients may report an Update as incorrect, outdated, or inappropriate.
- The Admin Community Safety surface is reduced to **Post Reports**. User reports, Community-only blocking, comment reports, Student publishing authorization, routine post approval, and appeals are retired from the active UI and API workflow.

## Notifications

When **Notify audience** is enabled, initial publication creates one in-app notification per unique resolved recipient:

- whole-school posts notify active school recipients;
- class posts notify the selected classes' Students, linked Parents, and assigned Teachers;
- the author is excluded from their own notification.

Editing does not resend notifications. Notification creation and post publication occur in one database transaction so recipients cannot receive a notification for a post that failed to publish. Notification category and destination point to Updates and the specific post.

## Existing Data Transition

No historical post, comment, report, reaction, media, or audit record is physically deleted.

- Existing published posts continue under their stored audience but render without comments.
- Existing `school` and `class` audiences remain valid.
- New publishing stops accepting direct `student` audiences.
- Existing direct-Student posts retain their historical visibility until withdrawn; no broader audience is inferred.
- Existing comments remain stored but are not returned by the active feed API or shown in the App.
- Existing pending-review posts remain non-public. A manager may explicitly publish or withdraw them during transition; the migration does not auto-publish them.
- `comments_enabled` remains as a compatibility column but is always false for new and edited Updates.

Schema removal is deferred because preserving moderation and audit history is more important than reducing table count. Retired APIs return a controlled unavailable response or are removed only after frontend callers and compatibility requirements are verified.

## Error Handling

- Composer content remains intact after validation, upload, audience, or network failure.
- Validation identifies the failed field or image instead of returning a generic publishing error.
- Backend rejects unauthorized publishing, cross-school classes, invalid media, and invisible-post Like/report attempts.
- If notification persistence fails, publication rolls back with a retryable error.
- A Like request is idempotent from the user's perspective and cannot create duplicates.

## Interface Boundaries

Implementation should keep these responsibilities separate:

- audience resolver: determines unique permitted viewers and notification recipients;
- post mutation service: publishes, edits, and withdraws transactionally;
- notification dispatcher: materializes recipient notifications within publication;
- feed query: filters posts for the authenticated viewer without trusting client audience claims;
- reaction service: applies one Like per user/post;
- report management: accepts viewer reports and allows authorized same-school decisions;
- App components: composer, audience selector, feed card, image viewer, and Like action;
- Admin components: employee User Abilities and Post Reports.

## Verification

Backend tests must cover:

- unauthorized, inactive, and cross-school publishing rejection;
- immediate publishing for an authorized employee;
- whole-school and multi-class audience resolution;
- Student, linked Parent, assigned Teacher, and manager visibility;
- unrelated Parent/Student/Teacher exclusion;
- duplicate-parent and multi-persona notification deduplication;
- Notify audience enabled/disabled behavior and edit non-resend behavior;
- one Like per visible user, unlike behavior, and invisible-post rejection;
- author versus manager edit/withdraw scope;
- soft withdrawal and preserved audit/report history;
- transactional rollback when audit or notification persistence fails;
- historical published, pending, direct-Student, and comment compatibility.

Admin and App tests must cover:

- User Ability labels and publish/manage visibility;
- Whole school versus multi-class selection;
- recipient summary and empty-audience warning;
- text/image-only composer with no video or comment controls;
- Teacher, Parent, and Student feed visibility;
- Like/unlike behavior;
- Post Reports management;
- absence of comments, user blocking, appeals, and Parent/Student publishing.

Run backend PHPUnit, Pint, route loading, additive migration/rollback checks, Admin Vitest/lint/build, and App Vitest/lint/build. MariaDB-sensitive behavior must be tested on a disposable MariaDB database or recorded as **Not verified**.

## Out of Scope

- Video and document uploads.
- Comments or text replies.
- Direct messaging, user discovery, public profiles, or Community user blocking.
- Parent or Student publishing.
- Per-post individual Student targeting for new posts.
- Scheduled publishing, expiry, read receipts, mandatory acknowledgement, push/email/SMS delivery, analytics, or external-link previews.
- Physical deletion of historical Community data.

These items require separate approval if reconsidered later.
