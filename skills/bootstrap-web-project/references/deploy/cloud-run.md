# Cloud Run deployment

Apply this reference when the project record states `deploy: "cloud-run"`,
together with the [serverless rules](serverless.md). The decision is recorded
in ADR 0024 of the foundation repository.

A Cloud Run service runs a container image on instances that Cloud Run
scales, each serving several requests at once up to its concurrency. Cloud
Run functions are Cloud Run services too, built by Google from source with
the Functions Framework, which parses the request body before the
application sees it. Prefer a service with the application's own image when
the code runs on a framework such as Fastify or Nest, needs the raw body for
signature checks or must run the same way locally; prefer a function for a
small, self-contained handler when Google maintaining the base image matters
more. Both are billed alike and follow every rule below.

Cloud Run sends `SIGTERM` with ten seconds before stopping an instance, so
the bounded graceful shutdown of [`FASTIFY-RUNTIME-001`](../stacks/fastify.md)
holds unchanged. The foundation ships no Dockerfile or infrastructure
definition for this target.

## `CLOUDRUN-SIZING-001` — explicit sizing of every service

- **Level:** MUST
- **Applies to:** projects with `deploy: "cloud-run"`
- **Risk levels:** R1, R2, R3
- **Requirement:** Set memory, CPU, concurrency and the maximum number of
  instances of every service and job explicitly in the infrastructure
  definition; never rely on the platform defaults. Choose concurrency from a
  measurement of the service, remembering that below one vCPU concurrency is
  limited to one. Keep the maximum instances times the database pool size per
  instance below the database or pooler connection limit.
- **Rationale:** The defaults neither match the application nor bound cost:
  the instance ceiling is the only cap on spend and on connections, and an
  unmeasured concurrency either wastes instances or exhausts memory.
- **Verification:** Review the infrastructure definition for the four values
  of every service and the connection arithmetic; a load test in a
  non-production environment confirms the concurrency.
- **Sources:** [Cloud Run concurrency](https://docs.cloud.google.com/run/docs/about-concurrency), [Cloud Run CPU limits](https://docs.cloud.google.com/run/docs/configuring/services/cpu), [Cloud Run maximum instances](https://docs.cloud.google.com/run/docs/configuring/max-instances), [`SEC-RESOURCE-001`](../security/baseline.md).
- **Exceptions:** None.

## `CLOUDRUN-PRIVATE-001` — internal services are not public

- **Level:** MUST
- **Applies to:** projects with `deploy: "cloud-run"` that run internal
  services, such as task workers or scheduled job handlers
- **Risk levels:** R1, R2, R3
- **Requirement:** Deploy each internal service without unauthenticated
  access and grant the invoker role only to the service accounts of the queue
  and the scheduler that call it. The application also verifies the OIDC
  token of each request, its audience and its service account, as a second
  defense.
- **Rationale:** A public worker lets anyone run jobs and tasks; the platform
  check removes the exposure, and the application check keeps it closed if
  the service is ever redeployed public.
- **Verification:** Review the service's ingress and invoker bindings; a test
  rejects a request without a token, with a wrong audience and with a wrong
  service account; a request to the deployed URL without credentials returns
  403.
- **Sources:** [Cloud Run authentication overview](https://docs.cloud.google.com/run/docs/authenticating/overview), [Cloud Tasks HTTP target tasks](https://docs.cloud.google.com/tasks/docs/creating-http-target-tasks), [Cloud Scheduler: create and configure jobs](https://docs.cloud.google.com/scheduler/docs/creating), [`SEC-INTEGRATION-001`](../security/baseline.md).
- **Exceptions:** A local development adapter may accept a fixed development
  token that the configuration rejects outside development.

## `CLOUDRUN-SECRETS-001` — pinned secrets per service account

- **Level:** MUST
- **Applies to:** projects with `deploy: "cloud-run"`
- **Risk levels:** R1, R2, R3
- **Requirement:** Keep secrets in Secret Manager and expose them to services
  as environment variables or mounted files referencing a fixed version,
  never `latest`; rotating a secret is a new version plus a deployment. Run
  each service under its own service account, granted access only to the
  secrets that service uses.
- **Rationale:** A pinned version makes every rotation an explicit, reviewed
  step and lets a bad version be rolled back; separate accounts keep a
  compromised service from reading the others' secrets.
- **Verification:** Review the infrastructure definition for version
  references and for the secret accessor bindings of each service account.
- **Sources:** [Cloud Run secrets](https://docs.cloud.google.com/run/docs/configuring/services/secrets), [`SEC-SECRETS-001`](../security/baseline.md), [`CORE-CONFIG-001`](../standards/core.md).
- **Exceptions:** None.

## `CLOUDRUN-ORIGIN-001` — an external edge is the only way in

- **Level:** MUST
- **Applies to:** projects with `deploy: "cloud-run"` that serve public
  traffic through an external edge, such as a CDN or an edge worker
- **Risk levels:** R1, R2, R3
- **Requirement:** The edge adds a secret header to every request it
  forwards, and the service rejects requests without it, because the
  service's own `run.app` URL stays reachable. The client IP is read from the
  edge's header only on requests that carry the secret; on any other request,
  forwarded headers are ignored.
- **Rationale:** Without the check, anyone can bypass the edge's protections
  and forge the client IP that rate limits, audit and security events depend
  on.
- **Verification:** A test rejects a request without the secret and shows a
  forged forwarded header does not change the client IP; a request to the
  `run.app` URL in a non-production environment is rejected.
- **Sources:** [Cloud Run ingress](https://docs.cloud.google.com/run/docs/securing/ingress), [`SEC-SECRETS-001`](../security/baseline.md), [`SEC-AUDIT-001`](../security/baseline.md).
- **Exceptions:** Google's own load balancer with internal ingress makes the
  header unnecessary; record which one is in place.

## `CLOUDRUN-PROXY-001` — trusted proxies as a hop count, one client IP

- **Level:** MUST
- **Applies to:** projects with `deploy: "cloud-run"` whose code reads the
  client IP or the request protocol
- **Risk levels:** R1, R2, R3
- **Requirement:** Trust forwarded headers by the number of hops Google and
  any load balancer write at the right end of `X-Forwarded-For`, measured in a
  non-production environment and set in the validated configuration (0
  locally); never trust every proxy, such as Fastify's `trustProxy: true`. In
  Fastify 5, whose typings refuse a number, pass `(address, hop) => hop < hops`.
  Behind an external edge the client IP comes from the edge header as
  `CLOUDRUN-ORIGIN-001` above says, and the hop count decides only the
  protocol. Expose the client IP as
  one request property that every rate limit, audit record and security log
  line reads, and read the protocol through the framework, never from a raw
  `x-forwarded-proto` header.
- **Rationale:** Trusting every proxy takes the leftmost `X-Forwarded-For`
  entry, which the client writes, so limits and audit count an address the
  attacker chooses; an address list meant for a private network does not match
  Google's front end and makes every request look like Google's. The count is
  fragile: adding a load balancer, CDN or Cloud Armor changes it silently.
- **Verification:** A test shows a forged `X-Forwarded-For` does not change the
  client IP and a forged `x-forwarded-proto` does not change the protocol;
  review that limits, audit and logs read the one property. The deployment
  checklist measures the count again whenever the chain in front of the
  service changes.
- **Sources:** [Fastify `trustProxy`](https://fastify.dev/docs/latest/Reference/Server/#trustproxy), [External Application Load Balancer: `X-Forwarded-For`](https://docs.cloud.google.com/load-balancing/docs/https#x-forwarded-for_header), [`SEC-AUDIT-001`](../security/baseline.md), [`SEC-RESOURCE-001`](../security/baseline.md).
- **Exceptions:** None.

## `CLOUDRUN-IMAGE-001` — maintained base image

- **Level:** SHOULD
- **Applies to:** projects with `deploy: "cloud-run"` that build their own image
- **Risk levels:** R1, R2, R3
- **Requirement:** Update the base image and redeploy within the vulnerability
  triage timeframes the project defines under `SEC-SUPPLY-001`, and pin the
  image by digest in the deployment.
- **Rationale:** With its own image, the project rather than Google owns
  Node.js and operating-system updates; a pinned digest makes the deployed
  image reproducible.
- **Verification:** Review the image's base tag and its update history against
  the triage timeframes; Artifact Registry vulnerability scanning, where
  enabled, reports outdated images.
- **Sources:** [Cloud Run functions comparison](https://docs.cloud.google.com/run/docs/functions/comparison), [`SEC-SUPPLY-001`](../security/baseline.md).
- **Exceptions:** Functions built from source by Google need no project
  image maintenance.

## `CLOUDRUN-PROJECT-001` — one Google Cloud project per environment

- **Level:** SHOULD
- **Applies to:** projects with `deploy: "cloud-run"`
- **Risk levels:** R1, R2, R3
- **Requirement:** Use a separate Google Cloud project for each environment,
  such as staging and production, each with its own permissions, secrets,
  budget and alerts.
- **Rationale:** Project boundaries separate access, secrets and billing
  without naming conventions, and a production project can be handed over on
  its own.
- **Verification:** Review the infrastructure definition for one project per
  environment and the IAM bindings of each.
- **Sources:** [`SEC-SECRETS-001`](../security/baseline.md), practitioner experience with environment isolation.
- **Exceptions:** Short-lived preview environments may share the staging
  project.
