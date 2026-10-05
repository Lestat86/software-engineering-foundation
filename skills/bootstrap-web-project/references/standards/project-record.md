# Project record standard

These requirements keep the decisions a project made about the foundation
explicit and checkable after bootstrap. The generated
`.config/foundation/check-foundation.mjs` verifies both as part of `lint`.

## `RECORD-MANIFEST-001` — a valid and truthful project record

- **Level:** MUST
- **Applies to:** all generated projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Keep `.engineering-foundation.yml` complete and consistent
  with the project: a semantic `foundationVersion`, the applied `profiles`, a
  security `level` with its `rationale`, the `ci` profile, the `workflow` mode
  (`assisted` or `autonomous`) and a `packageManager` equal to the one in
  `package.json`. Update it in the same change that alters what it records.
- **Rationale:** Review, agents and future foundation updates read the record
  to decide which requirements, thresholds and review loop apply. A record that
  drifts from the project silently selects the wrong ones.
- **Verification:** `check-foundation.mjs` rejects a missing or invalid field
  and a package manager mismatch, and warns when an R1 project depends on an
  authentication or payment library, which is an R2 trigger.
- **Sources:** [NIST SSDF 1.1](https://csrc.nist.gov/pubs/sp/800/218/final), practitioner experience with production TypeScript applications.
- **Exceptions:** None.

## `RECORD-EXCEPTION-001` — recorded and expiring exceptions

- **Level:** MUST
- **Applies to:** all generated projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Record every intentional deviation from a MUST requirement
  in `docs/exceptions.yml` with the requirement `id`, the affected `scope`, the
  `justification`, the `owner`, an `expires` date and, when one exists, the
  `compensatingControl`. Review an exception before it expires, then renew it
  with a new date or remove it together with the deviation.
- **Rationale:** An exception without an owner and an end date becomes
  permanent by default. Making expiry fail the gate turns every exception into
  a scheduled review instead of a forgotten decision.
- **Verification:** `check-foundation.mjs` rejects an entry with a missing
  field, a requirement identifier absent from
  `.config/foundation/requirements.json`, an invalid date or an expiry date in
  the past.
- **Sources:** [OWASP ASVS 5.0.0](https://github.com/OWASP/ASVS/tree/v5.0.0/5.0), practitioner experience with production TypeScript applications.
- **Exceptions:** None. A deviation from a SHOULD requirement may be recorded
  in the same register when the reason deserves an owner and a review date.
