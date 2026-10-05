---
name: record-exception
description: Record a deliberate deviation from a Software Engineering Foundation requirement in the project's exception register, with its scope, justification, compensating control, owner and expiry. Use when a change must deviate from a MUST requirement, when the reviewer asks for an exception, or when lint reports an expired exception.
---

# Record an exception

An exception is a decision a person takes, with an owner and an end date. You
prepare it; the person confirms it.

## Steps

1. Identify the requirement. Find its identifier in
   `.config/foundation/requirements.json` and read its text in
   `docs/foundation/`, including its own **Exceptions** field: if the
   requirement already allows the case, apply that instead and record nothing.
2. Prefer compliance. State what complying would take. Record an exception
   only when the person accepts the deviation.
3. Ask the person for what you cannot know: the owner, and how long the
   deviation should last. Propose an `expires` date when the deviation should
   realistically be reviewed, not a distant one.
4. Add the entry to `docs/exceptions.yml`:

   ```yaml
   exceptions:
     - id: <REQUIREMENT-ID>
       scope: <the files, routes or components it covers, as narrow as possible>
       justification: <why complying is not possible or not proportionate now>
       compensatingControl: <what limits the risk meanwhile, if anything>
       owner: <person or team>
       expires: <YYYY-MM-DD>
   ```

5. If a lint suppression marks the site, give it the same reason after `--`.
6. Run `corepack yarn lint:foundation` and fix what it reports.

For an expired exception: review whether the deviation still exists. If it
does not, delete the entry; if it does, ask the person whether to renew it and
set a new date.
