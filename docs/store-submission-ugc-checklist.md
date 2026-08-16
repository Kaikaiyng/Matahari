# UGC Store Submission Checklist

**Status:** Operator checklist. Completion does not guarantee Apple App Store or Google Play approval.

## Code and environment

- [ ] Exact release commit passed Backend PHPUnit/Pint/routes, Admin test/lint/build, App test/lint/build, deployment contracts, and secret/artifact checks.
- [ ] Disposable SQLite and MariaDB migrate/rollback/re-migrate passed; Community moderation tests passed on MariaDB.
- [ ] Production `php artisan app:store-readiness` passes.
- [ ] Terms, Privacy, Community Standards, Child Safety and Support are public HTTPS URLs matching store metadata.
- [ ] Support and child-safety addresses are real, monitored, externally tested and not placeholders.

## Reviewer evidence

- [ ] Reviewer accounts use synthetic data and cover required Parent/Student/Teacher/Staff paths.
- [ ] Review notes explain policy acceptance, posting, content/user reporting, block/unblock, My Reports and appeals.
- [ ] Record screenshot/video paths for policy acceptance, separate report/block actions, confirmation, blocked-user management, pending review, moderation queue, severe escalation and appeal separation.
- [ ] Reviewer can open every legal page without login.
- [ ] Account-deletion requirements are separately assessed for the eventual native account model.

## Apple and Google declarations

- [ ] Apple age rating, UGC/social behavior, privacy labels and review notes match the release.
- [ ] Google target audience, Data safety, Families/children, UGC, ads and content rating match the release.
- [ ] Child Safety Standards names RYLAY, prohibits CSAE/CSAM, explains enforcement/reporting and provides a safety contact.
- [ ] Privacy covers identity, school scope, contributions, reports, moderation, evidence retention and security context.
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
