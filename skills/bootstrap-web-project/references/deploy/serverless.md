# Serverless deployment

Apply this reference when the project record names a `deploy` target other
than `none`. The decision is recorded in ADR 0024 of the foundation
repository. Each target adds its own reference, such as
[Cloud Run](cloud-run.md); the rules below hold on every serverless platform.

A serverless platform runs the application as instances it starts and stops
on its own. Three facts follow, and every rule here comes from one of them:

- instances come and go: one may stop at any time after it has served its
  requests, and memory is lost with it;
- the CPU may be throttled or stopped once a response is sent, so work left
  running afterwards may never finish;
- more than one instance serves the same application at once, so memory is
  never shared and the same job or task may run twice.

The foundation ships no deployment asset for these rules: images,
infrastructure as code and the outbox code belong to the project.

## `SERVERLESS-RESPONSE-001` — no work after the response

- **Level:** MUST
- **Applies to:** projects with a `deploy` target other than `none`
- **Risk levels:** R1, R2, R3
- **Requirement:** Finish all work of a request before its response is sent:
  no promise left unawaited, no work started in a response hook such as
  Fastify's `onResponse` or an interceptor after the handler returns, no timer
  that outlives the request. Work that cannot complete before the response is
  enqueued, following `SERVERLESS-OUTBOX-001`.
- **Rationale:** Once the response is sent the platform may stop the CPU or
  the instance; detached work then runs late, partly or never, and the
  failure is silent.
- **Verification:** `@typescript-eslint/no-floating-promises`, part of the
  shared typed ESLint configuration, rejects unawaited promises; review response hooks and every `setTimeout` or
  `setImmediate` in request code. A test that awaits the response and then
  asserts the side effect fails when the effect is detached.
- **Sources:** [Cloud Run billing settings and CPU allocation](https://docs.cloud.google.com/run/docs/configuring/billing-settings), [Cloud Run container runtime contract](https://docs.cloud.google.com/run/docs/container-contract).
- **Exceptions:** None. A platform setting that keeps the CPU allocated
  between requests does not make detached work safe, because the instance can
  still stop.

## `SERVERLESS-STATE-001` — no correctness in process memory

- **Level:** MUST
- **Applies to:** projects with a `deploy` target other than `none`
- **Risk levels:** R1, R2, R3
- **Requirement:** Keep no state in process memory that correctness depends
  on: rate limits against brute force, deduplication, idempotency keys,
  sessions, locks and job state live in a shared store reached through a port
  ([`STRUCT-PORT-001`](../standards/project-structure.md)). Memory holds only
  optimizations whose loss or divergence between instances is harmless, such
  as a cache or a per-instance burst brake.
- **Rationale:** Each instance sees only its own memory and loses it when it
  stops, so an in-memory counter divides by the number of instances and an
  in-memory deduplication lets duplicates through.
- **Verification:** Review module-level mutable state and in-memory stores in
  server code. For each limit or deduplication, a test with two application
  instances on the same store shows the second instance sees the first one's
  effect.
- **Sources:** [`SEC-RESOURCE-001`](../security/baseline.md), [Cloud Run concurrency and instances](https://docs.cloud.google.com/run/docs/about-concurrency).
- **Exceptions:** A per-instance brake bounded in total by the platform's
  instance limit is acceptable for burst control when the evidence states it
  is per instance; never for authentication limits.

## `SERVERLESS-OUTBOX-001` — work born from a data change goes through an outbox

- **Level:** MUST
- **Applies to:** projects with a `deploy` target other than `none` that
  enqueue work as a consequence of a database change
- **Risk levels:** R1, R2, R3
- **Requirement:** Write the work as an outbox row in the same transaction as
  the change that causes it. After the commit and before the response, send
  each row to the queue and mark it sent. Name the queued task after the row
  identifier, so a second send is rejected as a duplicate and counts as
  success. A periodic recovery resends only unsent rows older than a margin,
  claiming them with `FOR UPDATE SKIP LOCKED` so two recoveries never take the
  same row.
- **Rationale:** A change and its work then exist together or not at all: a
  crash between commit and send delays the work until the next recovery but
  never loses it, and the queue name stops duplicate sends.
- **Verification:** Database tests show a rolled-back transaction leaves no
  row, a committed one leaves a row that is sent once, and a crash before the
  send is recovered by the periodic run; review that no queue client is
  called inside a transaction.
- **Sources:** [Transactional outbox pattern](https://microservices.io/patterns/data/transactional-outbox.html), [Cloud Tasks or Pub/Sub](https://docs.cloud.google.com/tasks/docs/comp-pub-sub), [PostgreSQL `SELECT` locking clause](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE).
- **Exceptions:** Work that does not depend on a data change, such as a
  scheduled run, is enqueued directly.

## `SERVERLESS-IDEMPOTENT-001` — idempotent task and job handlers

- **Level:** MUST
- **Applies to:** projects with a `deploy` target other than `none`
- **Risk levels:** R1, R2, R3
- **Requirement:** Every task and scheduled job handler can run more than once
  for the same input with the effect of one run. Before acting it reads the
  state it changes under a lock, such as `SELECT … FOR UPDATE` on the row or a
  transaction-scoped advisory lock, and stops when the work is already done.
  The last failed attempt records the outcome and raises an alert, because a
  queue without a dead-letter destination drops it silently.
- **Rationale:** Queues and schedulers deliver at least once, recoveries
  resend, and two instances may receive the same task: only the handler can
  make a duplicate harmless.
- **Verification:** A test runs each handler twice, and concurrently where a
  lock is involved, and asserts one effect; review that the handler reads the
  attempt count and handles the final failure.
- **Sources:** [Cloud Tasks or Pub/Sub](https://docs.cloud.google.com/tasks/docs/comp-pub-sub), [Cloud Scheduler: create and configure jobs](https://docs.cloud.google.com/scheduler/docs/creating), [`SEC-INTEGRATION-001`](../security/baseline.md).
- **Exceptions:** None.

## `SERVERLESS-SCHEDULE-001` — declared schedules with an absence heartbeat

- **Level:** MUST
- **Applies to:** projects with a `deploy` target other than `none` that run
  scheduled jobs
- **Risk levels:** R1, R2, R3
- **Requirement:** Declare each schedule once, in the code that handles it,
  with its name, cron expression, time zone and handler; the infrastructure
  definition is produced from that list, not written again. Guard every run
  against an overlapping run with a lock and make it idempotent
  (`SERVERLESS-IDEMPOTENT-001`). Every scheduled job writes a completion
  signal when it succeeds, and an alert fires when the signal is missing for
  longer than a threshold set per job above its period.
- **Rationale:** A job that does not run writes no error. Without an absence
  heartbeat, a stopped job that expires subscriptions or deletes data can stay
  stopped for days unnoticed.
- **Verification:** Review that the infrastructure definition is generated
  from the declared list and that each job has an absence alert with its
  threshold; a test of each handler asserts the completion signal on success
  and its absence on failure.
- **Sources:** [Cloud Scheduler: create and configure jobs](https://docs.cloud.google.com/scheduler/docs/creating), [Cloud Monitoring alerting conditions, metric absence](https://docs.cloud.google.com/monitoring/alerts/types-of-conditions), [`SEC-AUDIT-001`](../security/baseline.md).
- **Exceptions:** None for the heartbeat. A one-off job run by hand is not a
  schedule.

## `SERVERLESS-ALERT-001` — alerts reach a configured recipient

- **Level:** MUST
- **Applies to:** projects with a `deploy` target other than `none`
- **Risk levels:** R1, R2, R3
- **Requirement:** Alert log lines, missing heartbeats and a stalled queue,
  where the oldest pending task exceeds a threshold, notify a recipient
  configured per environment. The recipient is a distribution list or an
  on-call channel, not a named person, and the alert rules live in the
  infrastructure definition next to the jobs and queues they watch.
- **Rationale:** On a serverless platform nobody watches a process; an alert
  that reaches nobody, or one person who leaves, is the same as none.
- **Verification:** Review the alert rules and their recipient per
  environment; trigger each rule once in a non-production environment and
  confirm the notification arrives.
- **Sources:** [`SEC-AUDIT-001`](../security/baseline.md), [`CORE-CONFIG-001`](../standards/core.md), [Cloud Monitoring alerting conditions](https://docs.cloud.google.com/monitoring/alerts/types-of-conditions).
- **Exceptions:** None.

## `SERVERLESS-MIGRATION-001` — migrations run as their own backward-compatible step

- **Level:** MUST
- **Applies to:** projects with a `deploy` target other than `none` that own a
  database schema
- **Risk levels:** R1, R2, R3
- **Requirement:** Run database migrations as a separate deployment step
  before the new application version, never at instance start, and roll the
  application out only when the step succeeds. Each migration is backward
  compatible with the running version: add first, remove in a later release.
- **Rationale:** Several instances starting together would run the same
  migration concurrently, and during a rollout the previous version keeps
  serving on the new schema.
- **Verification:** Review the deployment script or pipeline for the
  migration step and its success condition, and that the image entry point
  does not migrate; review every migration that drops or renames for a prior
  release that stopped using the object.
- **Sources:** [Cloud Run jobs](https://docs.cloud.google.com/run/docs/create-jobs), practitioner experience with rolling deployments.
- **Exceptions:** A breaking migration needs a recorded maintenance window
  in which no previous version serves traffic.
