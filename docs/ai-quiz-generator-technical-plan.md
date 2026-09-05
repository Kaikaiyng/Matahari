# AI-Assisted Quiz Generator Technical Plan

**Status:** Approved direction, deferred implementation

**Reviewed against:** `master` at `80dd61825bfbb209197d464a36c376de78627c1d`

**Decision date:** 2026-08-13

## Purpose and Implementation Gate

RYLAY will eventually provide an AI-assisted Quiz Generator for authorized teachers and administrators. RYLAY remains authoritative for authorization, school and teaching scope, question types, validation, persistence, publication, assignment, marking, and audit. AI generates question content only; it is not an unrestricted chatbot.

This document records the approved design so the implementation can begin when the wider product roadmap reaches the Quiz stage. It does not authorize implementation now. Until that stage is explicitly started:

- do not install an AI SDK or configure a provider;
- do not add AI or Quiz APIs;
- do not activate the current Quiz preview controls;
- do not make live provider requests;
- do not represent Quiz authoring, delivery, or scoring as implemented.

## Approved V1 Scope

Quiz V1 will expose only:

- `multiple_choice`;
- `true_false`.

Both types use the existing `quiz_options` storage and the same server-side scoring mechanism. The architecture should reserve extension points for `short_answer` and `fill_blank`, but those types must remain disabled until their storage, validation, marking, review, and publication rules are implemented and approved.

For later types:

- `short_answer` should initially use manual teacher marking, not AI grading;
- `fill_blank` may use a dedicated normalized exact-match evaluator where appropriate;
- future migrations may add answer-key and submitted-text storage without changing historical V1 questions.

## Current Repository Assessment

The repository currently has an additive Quiz persistence foundation but no operational Quiz module.

Existing tables are:

- `quizzes`;
- `quiz_questions`;
- `quiz_options`;
- `quiz_assignments`;
- `quiz_assignment_class_targets`;
- `quiz_assignment_student_targets`;
- `quiz_assignment_recipients`;
- `quiz_attempts`;
- `quiz_attempt_answers`.

The schema already preserves:

- formal and personal-practice Quiz identities;
- draft and publication state;
- immutable-style revisions;
- optional Assessment linkage;
- class targets and direct student targets;
- deduplicated materialized assignment recipients;
- attempt history and server-side score fields.

The repository does not yet contain Quiz models, services, policies, access services, controllers, API routes, assignment resolution, scoring workflows, or Quiz audit events. The Student and Teacher App Quiz surfaces remain disabled design previews.

## SDK Decision

Use the first-party [`laravel/ai`](https://github.com/laravel/ai) SDK unless a compatibility check at implementation time identifies a material regression.

At the review baseline, the repository uses PHP 8.4.21 and Laravel Framework 13.17.0. The reviewed Laravel AI package requires PHP `^8.3` and supports Illuminate 12 and 13, including structured output through Laravel JSON Schema. It is therefore compatible in principle. Dependency resolution, lockfile changes, published configuration, migrations, and the exact stable version must still be reviewed in the implementation branch.

Reasons for the decision:

- first-party Laravel integration;
- structured output and JSON Schema support;
- provider-independent application code;
- configurable provider, model, timeout, and failover;
- built-in fakes and prompt assertions for tests.

`openai-php/client` is a valid lower-level alternative but would require more RYLAY-owned provider, schema, and retry plumbing. `cognesy/instructor-php` offers stronger typed-output abstractions but is unnecessary for the initial two-type generator. Do not install multiple AI abstraction layers.

The provider and model must be deployment configuration, not Controller constants. OpenAI may be the initial provider, but no model name or price assumption in this document is permanent.

## Target Architecture

```text
Teacher or authorized administrator
        |
        v
POST /api/v1/quiz-authoring/ai-generations
        |
        v
QuizGenerationRequest
        |
        v
QuizAuthoringAccessService
        |
        v
QuizGenerationService
        |
        +--> controlled prompt builder
        +--> Laravel AI structured-output agent
        +--> output and distribution validator
        |
        v
Editable preview (not a Quiz record)
        |
        v
Teacher confirmation
        |
        v
POST /api/v1/quizzes
        |
        v
Transactional draft persistence and audit
```

Suggested backend concepts are:

- `QuizQuestionType` and `QuizDifficulty` enums;
- `QuizGenerationRequest`;
- `QuizGenerationData` and `GeneratedQuizQuestionData` DTOs;
- `QuizGeneratorAgent`;
- `QuizGenerationPrompt`;
- `QuizGenerationService`;
- `QuizGenerationOutputValidator`;
- `QuizAuthoringAccessService`;
- `QuizService`, `QuizAssignmentService`, and `QuizScoringService` for the later core workflow.

Controllers should remain thin. Provider-specific code, prompts, output repair, scope decisions, persistence, and scoring must not accumulate in a Controller.

## Preview and Persistence Decision

Generated content remains frontend-only until the teacher confirms it. The teacher may edit, remove, or regenerate questions before confirmation. Confirmation submits the complete edited payload to RYLAY, where it is validated again and saved as a Quiz draft.

This avoids filling `quizzes` with abandoned generations and guarantees that AI cannot publish directly. A refresh may discard an unconfirmed preview; that is acceptable for V1.

A future additive `quiz_generation_runs` table is recommended for cost, rate-limit, reliability, and support evidence. It should record only:

- school and actor IDs;
- a client request UUID for idempotency;
- normalized controlled inputs and requested type counts;
- provider and model identifiers;
- status, latency, token usage, and returned question count;
- a stable application error code and timestamps.

Do not store API keys, full system prompts, raw provider exceptions, unnecessary raw outputs, student identities, grades, attendance, guardian information, or finance information.

## Structured Output Contract

V1 should use one options-based representation for both enabled types:

```json
{
  "title": "Photosynthesis",
  "questions": [
    {
      "type": "multiple_choice",
      "prompt": "Which part of a plant absorbs sunlight?",
      "explanation": "Leaves contain chlorophyll.",
      "options": [
        {"text": "Leaf", "is_correct": true},
        {"text": "Root", "is_correct": false},
        {"text": "Flower", "is_correct": false},
        {"text": "Seed", "is_correct": false}
      ]
    },
    {
      "type": "true_false",
      "prompt": "Plants require light for photosynthesis.",
      "explanation": "Light supplies energy for the process.",
      "options": [
        {"text": "True", "is_correct": true},
        {"text": "False", "is_correct": false}
      ]
    }
  ]
}
```

Provider-level structured output is necessary but not sufficient. RYLAY must independently validate:

- exact total question count and exact count per requested type;
- enabled question-type enum membership;
- required fields and maximum lengths;
- one and only one correct option per V1 question;
- exactly two canonical options for `true_false`;
- the approved MCQ option count, initially four;
- non-empty, non-duplicate options;
- reasonable duplicate-question detection;
- points assigned by RYLAY rather than AI.

Correct-answer fields must be excluded from all student delivery responses.

## Authorization and Scope

Add permissions through an additive corrective migration when implementation begins:

- `quizzes.view`;
- `quizzes.author`;
- `quizzes.generate_ai`;
- `quizzes.publish`;
- `quizzes.assign`.

Expected decisions are:

- Super Admin and School Admin may operate only inside the resolved school context unless an explicitly selected, authorized school context exists.
- Teachers may author and generate only for subjects and classes covered by a current active Teaching Assignment.
- Assignment targets must remain within the actor's authorized classes and current enrolment scope.
- Finance, CEO, Parent, and Student roles receive no AI-generation permission by default.
- A generic App `staff` presentation mode does not grant Quiz access. Backend permissions and resource scope remain authoritative.
- Multi-role users receive the union of permissions, but never bypass school, Teaching Assignment, guardian-child, or student-self scope.

Use the existing `SchoolContext`, permission middleware, policy, and access-service patterns. Frontend visibility is not an authorization boundary.

## Assignment and Scoring Boundaries

AI generation is separate from Quiz assignment. Saving a generated draft must not imply a whole-class assignment.

Formal assignments retain:

- zero or more class targets;
- zero or more direct student targets;
- materialized `quiz_assignment_recipients` records;
- deduplication where a student is reached by both target types;
- the resolved recipient snapshot even if enrolment changes later.

MCQ and True/False answers are scored on the backend. The server must resolve the correct option from stored question data and must not trust correctness, score, or points sent by the client. Attempt creation, submission, and scoring require transaction and concurrency tests before release.

## Input and Abuse Controls

Recommended initial configurable limits are:

- 1 to 20 total questions per generation;
- topic trimmed and limited to 160 characters;
- difficulty restricted to `easy`, `medium`, or `hard`;
- Subject selected by same-school ID rather than trusted free text;
- level derived from an authorized academic/class context where possible;
- three requests per minute and 30 per hour per user;
- 200 requests per day per school;
- at most one controlled schema/count repair retry;
- approximately 30 seconds provider timeout;
- client request UUID and disabled submit controls to reduce duplicate calls.

The exact production limits require usage and cost evidence and should remain configurable. Laravel route/action rate limiting should key on both actor and school. Provider rate limits do not replace RYLAY limits.

User-controlled fields must be treated as data, length-limited, normalized, and clearly delimited in the prompt. Users never control the system instruction. Prompt wording is not a security boundary; schema validation, authorization, enabled-type checks, and persistence validation remain mandatory.

## Failure Handling

Return stable RYLAY errors rather than raw provider responses:

- `AI_GENERATION_TIMEOUT`;
- `AI_PROVIDER_UNAVAILABLE`;
- `AI_OUTPUT_INVALID`;
- `AI_QUESTION_COUNT_MISMATCH`;
- `AI_UNSUPPORTED_QUESTION_TYPE`;
- `AI_RATE_LIMITED`;
- `AI_CONFIGURATION_UNAVAILABLE`.

Invalid output must never be saved. Retries should be narrow and bounded because an external provider call may already have incurred cost. Provider credentials, payloads, internal prompts, stack traces, and raw exceptions must not be returned to either frontend.

## Audit and Transaction Rules

Add explicit Quiz audit actions when implementation begins, including generation outcome, draft creation, revision, publication, assignment, recipient materialization, and any approved withdrawal action.

AI calls are external and cannot participate in a database rollback. The recommended sequence is:

1. create a generation-run record before the provider call;
2. make the provider call outside a database transaction;
3. transactionally update the run outcome and append the corresponding audit event;
4. leave an identifiable pending/unknown run for reconciliation if the final transaction fails.

Quiz draft creation, revision, publication, assignment, recipient resolution, attempt submission, and scoring are internal mutations and must write their audit event inside the same transaction. Do not place raw prompts, correct-answer sets, or provider secrets in general audit payloads.

## Database Changes at Implementation Time

Do not replace the existing Quiz tables. Use additive corrective migrations only.

Expected additions are:

- the `quiz_generation_runs` table and idempotency/index constraints;
- Quiz permissions and role-permission grants;
- any indexes proven necessary by the implemented list, recipient, and attempt queries;
- optional provenance fields linking a confirmed draft to its generation run.

The current string `question_type` column remains protected by backend enum validation. If a database-level check constraint is proposed, verify its exact PostgreSQL behavior and migration lifecycle first.

When later enabling short and fill-blank answers, use an additive design such as answer-key rows plus nullable submitted answer text and manual-marking metadata. Do not overload `quiz_options` with fake free-text options or rewrite historical V1 records.

Every related school ID must be verified consistently in the service layer. Existing independent foreign keys do not by themselves prove that a Quiz, Subject, class target, student target, and actor all belong to the same school.

## Frontend Direction

The Community App is the primary teacher authoring and student delivery surface. The Admin Panel may expose an administrative authoring/review surface later, but it remains a separate frontend using the same Laravel API and database.

Teacher generation flow:

1. select an authorized subject and class/level context;
2. enter a bounded topic;
3. select difficulty and counts for enabled types;
4. generate an editable preview;
5. edit, delete, or regenerate before confirmation;
6. confirm to save a draft;
7. publish and assign through separate explicit actions.

The UI must show loading, timeout, invalid-output, rate-limit, empty, and retry states. It must never expose the API key or call the provider directly. Students see only published Quiz assignments for which a materialized recipient exists.

## Testing Strategy

Tests must never depend on a paid or live AI provider. Use the Laravel AI agent fake and prevent stray prompts.

Required coverage includes:

- permission and role matrix, including multi-role users;
- inactive users and missing school context;
- cross-school, unrelated-class, and unrelated-subject rejection;
- Teacher Teaching Assignment scope;
- request lengths, enums, counts, and maximum total;
- prompt construction and user text delimiting;
- valid structured output;
- wrong totals and wrong per-type distribution;
- unsupported types and invalid option/correct-answer shapes;
- timeout, provider unavailability, provider rate limit, and invalid output;
- application rate limits and idempotency;
- generation Preview creates no Quiz rows;
- confirmed edited payload is fully revalidated;
- transactional Quiz persistence and audit rollback;
- class/direct target union and recipient deduplication;
- attempt concurrency and server-side scoring;
- migration fresh, rollback/re-migrate, existing-data upgrade, and PostgreSQL FK/index lifecycle;
- App and Admin regression suites, lint, type checking, builds, route loading, Pint, and full PHPUnit.

## Delivery Sequence and Complexity

Deliver the feature in separate reviewable slices:

1. Quiz core models, enums, policies, access services, permissions, authoring, revisions, and database constraints.
2. AI preview generation, structured validation, generation-run logging, rate limiting, and provider fakes.
3. Teacher editing, confirmation, publication, and assignment recipient materialization.
4. Student delivery, attempts, automatic V1 scoring, and authorized result views.
5. Only after separate approval, short-answer/fill-blank storage and marking workflows.

Overall complexity is medium-to-high because AI generation itself is small, while safe Quiz publication, targeting, historical recipient preservation, attempt concurrency, scoring, audit, and cross-school authorization are substantial. The simplest safe first release is a synchronous V1 preview generator with no conversation history, no tools, no unrestricted chat, two question types, and no AI grading.

## Revalidation Before Work Starts

Because SDK releases, provider models, prices, and structured-output behavior can change, the implementation phase must re-check:

- current `laravel/ai` stable version and Composer resolution;
- Laravel 13 and PHP compatibility;
- provider/model structured-output support;
- provider data-retention settings and school privacy requirements;
- current pricing and operational limits;
- PostgreSQL migration and constraint behavior;
- the then-current RYLAY Quiz schema and roadmap.

No implementation should proceed merely because this document exists; the Quiz stage must be explicitly started.
