# RYLAY UGC Moderation and Store-Safety Design

**Date:** 2026-08-16
**Status:** Approved design; implementation complete on the feature branch pending merge
**Scope:** Shared RYLAY Community moderation for every tenant. Tenant differences remain limited to approved branding and feature configuration.

## Objective

Prepare the authenticated school Community feature for Apple App Store and Google Play review with a strict, defensible moderation system. The implementation must provide preventive filtering, in-app content and user reporting, user blocking, timely human review, appeals, published standards, support contact paths, child-safety escalation, evidence preservation, and tenant-safe authorization.

The design follows the current requirements in:

- Apple App Review Guideline 1.2: <https://developer.apple.com/app-store/review/guidelines/>
- Google Play User Generated Content policy: <https://support.google.com/googleplay/android-developer/answer/9876937>
- Google Play moderation guidance: <https://support.google.com/googleplay/android-developer/answer/12923286>
- Google Play Child Safety Standards guidance: <https://support.google.com/googleplay/android-developer/answer/14747720>

Store approval cannot be guaranteed by code alone. A production submission also requires truthful store declarations, globally reachable HTTPS policy/support pages, real support and child-safety contacts, a legally reviewed CSAM escalation process, trained moderators, and demonstrated timely operations.

## Product Classification

RYLAY will not be positioned as a Kids Category or Designed for Families product. It is a private school and family administration product with authenticated, institution-provisioned users, including authorized minors. Because it includes a freeform Community feature and minor users may participate, this design still applies strict child-safety and adult-control safeguards.

RYLAY does not provide anonymous chat, random chat, dating, direct messaging, or public discovery. Community audiences remain school/class/student scoped.

## Chosen Moderation Model

RYLAY uses hybrid strict moderation:

- All submitted text is normalized and checked by shared server-side safety rules.
- Content from users without moderation authority enters `pending_review` and is not visible to other users.
- Media from users without moderation authority remains quarantined until approved.
- School or platform moderators may publish their own authorized content directly, but it remains reportable and auditable.
- Visible posts, comments, and their authors have separate, clearly labelled report and block actions.
- School Admin handles the school's queue. RYLAY Super Admin provides platform oversight and emergency intervention.

This model provides preventive filtering without sending student data to an external AI moderation provider. External automated scanning is outside V1 and may be added only as one shared, privacy-reviewed RYLAY capability.

## Content Lifecycle

Posts and comments use these application states:

- `pending_review`: accepted into quarantine, visible only to its author and authorized moderators.
- `published` or `visible`: approved and visible through existing audience rules, subject to user blocks.
- `rejected`: not published; author receives a reason category and may appeal once.
- `hidden`: previously visible content removed from ordinary access while evidence is preserved.

Existing published Community records remain published during migration. No historical content is deleted or silently reclassified.

Before accepting content, Laravel normalizes Unicode, repeated whitespace, zero-width characters, common character substitutions, links, and contact-like text. It applies shared multilingual prohibited-pattern rules, personal-information warnings, duplicate submission checks, and rate limits. Frontend checks are usability controls only.

The rules must never be tenant-specific code forks. A tenant feature may disable Community entirely, but cannot weaken the shared safety requirements.

## Reporting and Immediate Safety Actions

Users can separately report:

- a post;
- a comment;
- a user visible through an authorized Community record.

Reason codes are: `child_safety`, `sexual_content`, `bullying_harassment`, `threats_violence`, `self_harm`, `hate`, `privacy_exposure`, `impersonation`, `spam`, and `other`. `other` requires details. A reporter cannot submit a target they were not authorized to view, cannot choose tenant/school ownership, and cannot learn whether an unrelated target exists.

Reports for `child_safety`, `sexual_content`, or credible `threats_violence` temporarily quarantine the target immediately. Other reports enter review without automatically treating the report as proven. Rate limits and duplicate-active-report guards reduce report abuse.

Reporter identity is available only to authorized safety investigators where operationally necessary. It is never exposed to the reported user, content author, ordinary school staff, or public API response.

## User Blocking

Every Community user can block and unblock another Community author from an authorized post or comment. Blocking immediately removes that user's Community posts, comments, and interactions from the blocker's view and prevents direct Community interaction between the pair.

Blocking does not delete records, change the other user's school account, or hide Attendance, Finance, Schedule, or other essential school functions. Critical school communication must use the separate Notifications channel rather than bypassing a Community block.

## Moderator Queue and Enforcement

The Admin Panel receives a dedicated UGC Moderation workspace.

- School Admin sees only reports and content owned by the active tenant and school.
- RYLAY Super Admin receives cross-tenant counts and severe-case alerts, and may open case detail or intervene through `community.moderate_platform`.
- Normal platform dashboards do not expose a full cross-tenant Community feed.
- Queue ordering prioritizes severe category, deadline, and submission time.

Operational response targets are four hours for severe child-safety, sexual-content, or credible-threat cases and 24 hours for normal reports. The UI displays deadlines and overdue states. These are operational targets, not background jobs that falsely mark a case resolved.

Available actions are:

- no violation;
- warn author;
- approve, reject, or hide content;
- restrict comments;
- restrict publishing or media upload;
- temporarily suspend Community access;
- escalate to RYLAY child-safety review.

Community restrictions never disable unrelated school services. Every decision requires a reason and creates an append-only case action plus a transactional audit event. Evidence is preserved; ordinary moderation does not physically delete content or media.

## Appeals

Authors can submit one appeal for a rejected or hidden content decision or active Community restriction. The appeal records the disputed decision and the author's statement without rewriting the original case.

An appeal must be decided by a different eligible School Admin or by RYLAY Super Admin. The reporter's identity and confidential safety notes are not included in the author's view. The decision and any restored content are audited.

## Minor Safety and Adult Control

All users must accept the current Terms and Community Standards version before their first Community publication or comment after that version becomes effective.

Student users receive an in-app online-safety notice modal/banner before freeform interaction ("Do not share phone numbers, addresses, social media handles, private photos, or passwords. Be respectful to schoolmates."). Student commenting is disabled by default until an active, reviewed same-school Guardian link or School Admin performs an explicit adult authorization. That authorization can be revoked without removing read access to approved Community content.

Parents maintain granular controls (`can_post_community`, `can_upload_media`) over linked student social capabilities.

Freeform personal-information exchange is strictly prohibited and intercepted by server-side safety pattern filters (phone numbers, email addresses, URLs, and social handles like WhatsApp, Telegram, WeChat, IG, TikTok, LINE). No 1-on-1 private messaging or unmonitored direct user discovery is provided.

## Account Deletion Policy & Workflow

RYLAY operates on an **institution-provisioned SaaS account creation model** where Super Admin / School Admin provision verified accounts for staff, parents, and students (no public self-registration).

To fulfill Apple App Store Guideline 5.1.1(v) and Google Play account deletion mandates:
1. **In-App Request**: App Profile / Settings includes a "Request Account Deletion" option.
2. **Public Web URL**: A globally accessible, no-login HTTPS web page (`https://rylay.my/account-deletion`) allows users or guardians to submit deletion requests.
3. **Data Anonymization vs Retention Boundaries**: Upon processing a deletion request, user credentials, authentication tokens, PII (phone, email, real names), and non-essential Community posts/media are permanently purged or anonymized. Academic and financial history (fee agreements, payment receipts, attendance logs) are legally preserved in compliance with education and financial audit regulations, fully decoupled from personal identifiers.

## Apple 2026 Social Media Age Rating Mapping

To align with Apple 2026 App Store Connect Age Rating requirements for apps containing Social / UGC features:
- **User Generated Content / Social Features**: Declared with strict moderation safeguards.
- **Unrestricted Web Access**: NO (App has no open browser/URL bar or external link rendering).
- **Direct Messaging / Private Chat**: NO (No 1-on-1 private chat or unmonitored messaging).
- **Declared Guardrails**: Institution-provisioned accounts only, closed school scope, mandatory server-side pre-moderation/quarantine for unmoderated users, mandatory parent controls, 4-hour severe moderation SLA, and 100% human oversight.

## Public Policies and Support

The product provides globally reachable, no-login HTTPS pages for:

- Terms of Use;
- Privacy Policy;
- Community Standards;
- Child Safety Standards;
- Account Deletion Requests (`https://rylay.my/account-deletion`);
- Support and Appeals.

Community Standards define prohibited content and behavior, reporting, blocking, enforcement, appeal, and response expectations. Child Safety Standards explicitly prohibit CSAE, CSAM, grooming, sextortion, trafficking, and sexual exploitation, and describe the escalation commitment.

The App More page links to the policies and provides My Reports, Blocked Users, Appeals, and Contact Support. Tenant branding may supply the school's support contact for local resolution. RYLAY's platform support contact and designated child-safety point of contact are global safety configuration, not tenant-custom logic.

Production/store-readiness validation must fail if the real public URLs, support contact, or child-safety point of contact are absent. The repository must not invent or commit false contact details.

## Child-Safety Incident Operations

Severe cases support controlled evidence freezing, access restriction, case escalation, and an operator checklist for action under applicable law. The system does not automatically transmit student data or attempt to infer legal jurisdiction.

Before store submission, RYLAY must designate a person able to explain and execute its CSAE/CSAM procedures, obtain legal advice for the applicable reporting path, and document the relevant authority or NCMEC process. Confirmed illegal material must be handled according to the published standards and applicable law.

## Data Model

New additive storage:

- `community_policy_versions`: immutable shared policy versions, type, effective time, and public path.
- `community_policy_acceptances`: tenant, school, user, policy version, acceptance time, and security context.
- `community_reports`: tenant, school, reporter, target references, content snapshot, reason, priority, status, deadline, assignment, and resolution fields.
- `community_report_actions`: append-only case transitions, actor, reason, action metadata, and timestamp.
- `community_user_blocks`: tenant, school, blocker and blocked users, active state, and timestamps.
- `community_user_restrictions`: tenant, school, target user, restriction scope, reason, start/end, actor, and status.
- `community_appeals`: tenant, school, source decision, author statement, reviewer, decision, and timestamps.
- `student_community_authorizations`: tenant, school, student user, authorizing Guardian or School Admin, capability, effective/revoked timestamps.

Community post/comment records receive the minimum review-status, review actor/time, and decision-reason fields needed for safe lifecycle enforcement. Report snapshots preserve the evidence visible at report time. Foreign keys and indexes support tenant/school queue lookup, actor history, deadlines, active blocks/restrictions, and policy acceptance checks.

Money and finance tables are untouched.

## API and Authorization

App APIs provide:

- current policies and acceptance;
- report creation and the reporter's case status;
- block creation/removal/list;
- the author's pending/rejected content state;
- appeal creation/status;
- student safety notice and adult authorization state.

Admin APIs provide school-scoped queue list/detail, content review, enforcement, appeal review, and SLA summary. Platform APIs provide only Super Admin cross-tenant safety summary and explicit severe-case access/intervention.

All routes resolve an active tenant from a verified hostname before membership, permission, school, content, or report scope. Backend permissions are authoritative. Standard school moderation uses `community.moderate`; platform intervention uses new Super Admin-only `community.moderate_platform`.

Media download continues through authenticated authorization. Pending, rejected, hidden, blocked, or quarantined media fails closed except for explicitly authorized evidence review.

## UI

In the App, each visible post/comment author menu uses separate labels for Report Content, Report User, and Block User. Report forms explain emergency limitations and confirm submission. Block confirmation explains that only Community activity is affected.

Authors see a non-public Pending Review or Rejected status on their own content. Reporters see only `Submitted`, `Reviewing`, or `Resolved`; they do not see confidential notes or another user's penalty.

The Admin moderation workspace has queue filters, SLA indicators, target snapshot, prior case history, evidence access, required decision reason, enforcement controls, and appeal review. Sibling cards/panels continue to use the project-standard 16px parent-owned gap.

## Error Handling and Transactions

- Invalid, inaccessible, cross-tenant, or cross-school targets fail closed without target disclosure.
- Policy or adult-authorization failure returns an actionable validation response and creates no content.
- Text filter rejection returns the prohibited category without echoing unsafe source patterns.
- Submission plus evidence snapshot, moderation decision plus action history, enforcement plus audit, and appeal decision plus audit each use one database transaction.
- Media moved into quarantine is cleaned up if its database transaction fails.
- Audit persistence failure rolls back material moderation and enforcement mutations.

## Verification

Backend tests cover:

- tenant, school, role, audience, target, reporter, and moderator isolation;
- IDOR denial for reports, blocks, appeals, evidence, and media;
- policy acceptance and student adult authorization gates;
- text normalization/filtering, rate limiting, and duplicate active reports;
- pending content visibility to author/moderator only;
- immediate severe-case quarantine;
- blocked-user feed/comment behavior;
- moderator and platform permission boundaries;
- valid/invalid lifecycle transitions;
- appeal reviewer separation;
- transaction rollback when audit/action persistence fails;
- migration and rollback on SQLite and disposable MariaDB.

App tests cover policy acceptance, safety notice, pending states, report content/user, block/unblock, My Reports, Blocked Users, appeal entry, inaccessible media, and accessible labels. Admin tests cover school queue isolation, SLA display, required reasons, enforcement, platform escalation, appeal separation, and error states.

Release evidence includes full Backend/Admin/App suites, Pint, lint, builds, route loading, secret checks, MariaDB lifecycle, public policy link checks, reviewer demo accounts, screenshots, and an App Store/Play Console submission checklist.

## Non-Goals

- No anonymous/public chat, direct messaging, mentions, or user discovery.
- No tenant-specific moderation code or relaxed tenant policy.
- No external AI moderation provider in V1.
- No automatic legal reporting or invented legal determination.
- No physical deletion of moderation evidence through ordinary workflows.
- No claim that implementation alone guarantees store approval.
