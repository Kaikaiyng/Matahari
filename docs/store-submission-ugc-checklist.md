# School Updates Store Submission Checklist

**Status:** Operator checklist. Completion does not guarantee Apple App Store or Google Play approval.

## Code and environment

- [ ] Exact release commit passed Backend PHPUnit/Pint/routes, Admin test/lint/build, App test/lint/build, deployment contracts, and secret/artifact checks.
- [ ] Disposable SQLite and MariaDB migration checks appropriate to the release passed; School Updates audience, publication, reporting, and moderation tests passed on MariaDB or are explicitly recorded as **Not verified**.
- [ ] Production `php artisan app:store-readiness` passes (verifying Terms, Privacy, Community Standards, Child Safety, Support, and Account Deletion URLs).
- [ ] Terms, Privacy, Community Standards, Child Safety, Support, and Account Deletion Request are public HTTPS URLs matching store metadata.
- [ ] Support and child-safety addresses are real, monitored, externally tested and not placeholders.

## Reviewer evidence

- [ ] Reviewer accounts use synthetic data and cover required Parent, Student, and Teacher paths; there is no Staff persona.
- [ ] Review notes explain the forced policy-acceptance overlay, employee-only immediate School Update publishing, whole-school/multi-class audiences, optional notifications, Likes, Post Reports, and manager report decisions.
- [ ] Review notes explicitly state that Parent/Student cannot publish and that active Updates have no comments, new direct-Student targeting, user blocking, restrictions, appeals, or routine approval.
- [ ] Record screenshot/video paths for policy acceptance, eligible publishing and audience selection, Parent/Student read/Like/report behavior, Post Report confirmation, manager decision history, severe escalation, and child-safety/support access.
- [ ] Reviewer can open every legal page (including public Account Deletion Request page) without login.
- [ ] Public Account Deletion instructions and the in-app policy/support link function cleanly. Verify the real support-led request process before submission; do not claim automated purge/anonymization until that operational workflow is implemented and tested.

## Apple and Google declarations

- [ ] Apple 2026 age rating questionnaire explicitly reflects closed school scope, zero open web browsing, zero 1-on-1 private chat, institution-provisioned accounts, authorized employee publishing, no comments, and Post Report moderation.
- [ ] Google target audience, Data safety, Families/children, UGC, ads and content rating match the release.
- [ ] Child Safety Standards names RYLAY, prohibits CSAE/CSAM, explains enforcement/reporting and provides a safety contact.
- [ ] Privacy covers identity, school/class audience scope, official Updates, Likes, reports, moderation, account-deletion boundaries, evidence retention and security context.
- [ ] No claim of automated detection, 24/7 staffing, deletion timing, certification or legal completion is made without evidence.

## Operations and legal blockers

- [ ] Named moderators staff the 4-hour severe and 24-hour normal targets with escalation/on-call ownership.
- [ ] Qualified counsel approves the lawful CSAM preservation/reporting procedure and authorized personnel; suspected material is never placed in ordinary tickets/email.
- [ ] Evidence access, legal hold, retention, deletion, appeal and lawful-request procedures are approved and tested. Automated retention is not implemented.
- [ ] Incident response, safeguarding escalation, emergency language and support each have primary/backup owners.
- [ ] Monitoring covers overdue severe cases, failed notifications, moderation errors and policy-page availability.
- [ ] Human review confirms no demo credentials, real student data, private evidence, secrets or placeholder contacts ship.

## Publication record

- [ ] Record commit/build IDs, reviewer-account owner, policy versions, approvers and submission timestamps.
- [ ] Save Apple review notes and Google reviewer instructions in the controlled release record.
- [ ] Monitor moderation and support during rollout; approval does not replace ongoing compliance.
