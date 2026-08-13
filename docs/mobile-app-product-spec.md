# MIS App Product Specification

**Status:** Approved direction; visual foundation and daily Attendance are live, Community/Assessment/Quiz storage foundations are implemented, and their APIs remain future controlled slices

**Approved:** 2026-08-12; implementation status reviewed 2026-08-13

## Product Definition

The independent `app/` workspace is a private MIS school-community and self-service product. It shares the Laravel backend, MariaDB database, users, roles, permissions, school scope, academic records, audit system, and finance source of truth with `frontend/`. It is not a smaller copy of the Admin Panel.

Home is a relationship-scoped school and classroom Feed inspired by the useful community pattern in ClassDojo. Personal records remain separate from the Feed so photographs and school updates do not blur the privacy or authority of attendance, grades, Quiz results, and finance data.

## Roles and Navigation

The App uses a compact sticky identity header plus a role-aware floating liquid-glass navigation capsule. The active destination displays its icon and label; inactive destinations display icons with accessible names. The navigation respects device safe areas and every interactive target is at least 44px. Sign out is intentionally placed in More/Profile so the header stays focused on identity and notifications.

### Parent

- **Home:** School and linked-class posts, reactions, controlled comments, announcements, and event cards.
- **Children:** Multi-child switcher, identity, class, attendance summary, and attention items.
- **Academics:** Published assessment results, subject summaries, teacher comments, and published formal Quiz results.
- **Finance:** Authoritative outstanding balance, charge breakdown, verified payments, and receipts. No payment interface.
- **More:** Profile, notifications, language, privacy information, and sign out.

### Student

- **Home:** School/class posts allowed for students.
- **Learn:** Own subjects, attendance, published assessments, and teacher feedback.
- **Quiz:** Teacher-assigned formal Quiz plus separate personal Practice Quiz history.
- **Schedule:** Classes, events, and approved due dates.
- **More:** Profile, notifications, settings, and sign out. Student Finance is absent.

### Teacher and Authorized Staff

- **Home:** Visible Feed and the user's own recent posts.
- **Classes:** Teaching-assignment-scoped classes and students.
- **Create:** Text, photo, video, file, or event post composer with audience and comment controls.
- **Attendance:** Daily class attendance in the first UI; the schema also supports lesson and event sessions.
- **More:** Quiz authoring, assessment entry, profile, settings, and sign out.

Admin Panel remains the desktop location for content moderation, permission management, audit review, and broad operational correction. Mobile publishing does not grant unrestricted Admin access.

## Community Feed

- Authorized Staff may publish school-wide posts.
- A Teacher may publish only to classes allowed by a current teaching assignment.
- Parent visibility derives from an active, reviewed guardian-child relationship and the child's current enrolment.
- Student visibility derives from the student's own link and current enrolment.
- A post may contain text, multiple photos, a short video, files, or an event reference.
- Parent/Student users may react. Comments are enabled or disabled per post.
- Users may remove their own comments. Teachers may moderate comments on their own posts; authorized Staff/Admin may hide content and act on reports.
- Content removal preserves moderation and audit history. Media access must use the same audience checks as the containing post.
- Media consent, retention, file-size/type limits, malware scanning, and reporting response times remain controlled production gates.

**Current implementation:** scoped APIs and App flows now provide school-wide Staff publishing, Teaching Assignment-scoped Teacher class publishing, relationship-scoped Parent/Student feeds, private authorized media upload/download, appreciations, controlled comments, comment removal, Staff post hiding, and transactional audit events. Direct-student authoring, event-post composition, reporting, malware scanning, retention automation, and the complete desktop Admin moderation workspace remain planned.

## Attendance

Attendance uses a general session model with `daily`, `lesson`, and `event` types. The initial App UI exposes only daily class attendance.

Each session records school, academic year, class, date, type, optional subject/teaching assignment, creator, and timestamps. Each student record stores `present`, `absent`, `late`, or `excused`, a public note when appropriate, actor, and update metadata.

Teachers may mark only students in classes covered by current teaching assignments. Parent and Student reads are relationship/self scoped. Corrections require a reason and preserve audit history. Migration must not infer historical attendance.

**Current implementation:** the additive session/record schema, Teacher daily roster submission, correction reason/audit, Parent academic-capability read, and Student self read are present. `lesson` and `event` remain schema concepts and are not exposed by the UI.

## Assessments and Results

- Academic terms belong to an academic year.
- Assessments belong to a subject and may target one or more authorized classes.
- Types include Quiz, Test, Project, and Exam without prescribing a school grading formula.
- Results store score, optional grade label, and teacher comment.
- Draft and Published states are explicit. Parent/Student users see only Published records.
- Class ranking is not exposed.
- Formal Quiz may link to an Assessment, but it does not automatically alter a term total without an approved school rule.
- Migration must not infer historical terms, marks, weights, or publication status.

**Current implementation:** Academic Term management, Teaching Assignment-scoped Teacher assessment creation, draft result entry, complete-roster publication, and relationship/self-scoped published Parent/Student result views are connected. Publication and audit share one transaction, and published results cannot be silently rewritten. No dates, historical results, grade formulas, weights, or rankings are inferred. A broader desktop Admin assessment workspace and an approved correction/version workflow remain future work.

## Quiz

Formal Assigned Quiz and personal Practice Quiz are separate products.

- Teacher Quiz V1 supports `multiple_choice` and `true_false` through the same option/scoring mechanism.
- Formal assignments preserve multiple class targets, direct student targets, and materialized `quiz_assignment_recipients` deduplication.
- Correct answers and scoring remain server-side. Published Quiz content is revised through a new version rather than silently rewritten.
- Practice Quiz results remain private to the student and never become official grades.
- AI generation is a future authoring adapter. It is not installed, invoked, or represented as working.

**Current implementation:** additive tables exist for formal/practice Quiz identity, immutable-style revisions, `multiple_choice`/`true_false` questions using shared options, formal class/direct-student targets, deduplicated materialized recipients, attempts, and answers. Authoring, publication, recipient resolution, delivery, scoring, Practice generation, APIs, and audit events remain unimplemented.

## Parent Finance

Parent Finance is read-only. The App reuses `fee_record_charges`, verified allocations, payments, and receipt output. It does not create a balance cache, payment gateway, bank-proof upload, payment notice simulation, or `Pay now` control.

An authorized guardian sees the account records of an explicitly linked child when the relationship's finance capability is active. Existing ambiguous or unreviewed guardian links receive no automatic access.

## Security and Audit

- Laravel is authoritative for role permission, school scope, teaching assignment, guardian-child scope, student-self scope, and publication status.
- Mutating APIs use authenticated active users, `SchoolContext`, permission middleware, access services/policies, validation, and transactional audit events.
- Cross-school identifiers are rejected even when a user knows a valid ID.
- Sensitive media URLs are not public and must not provide an authorization bypass.
- Native authentication, Sanctum, Firebase, Capacitor, push delivery, and App Store packaging remain separate future work.

## Delivery Slices

1. Design system, compact App header, role-specific liquid-glass navigation, Feed presentation, calmer phone-first record pages, profile sign out, and Admin login restoration. **Implemented and merged in `816ea1d`.**
2. Community persistence schema. **Implemented as a storage-only foundation; services/APIs remain pending.** Publishing/reactions/comments, media delivery, moderation, and audit follow separately.
3. Daily Attendance schema, Teacher marking, Parent/Student history, and correction audit. **Implemented and merged in `816ea1d`.**
4. Assessment persistence schema. **Implemented as a storage-only foundation; services/APIs remain pending.** Entry/publication and Parent/Student result views follow separately.
5. Formal Quiz and separate Practice Quiz. **Storage foundation implemented; authoring, assignment materialization, attempts/scoring APIs, and Practice generation remain pending.**
6. Production media pipeline, push, native authentication review, and store packaging.

Each slice uses additive corrective migrations and must state which screens are live data, preview data, or planned.
