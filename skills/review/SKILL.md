---
name: review
description: Review the current branch of a Software Engineering Foundation project before opening a pull request, with the foundation-reviewer agent, against the feature plan and the foundation requirements. Use when the user asks for a review before a pull request or merge request, or when an autonomous workflow reaches its review step.
---

# Review before a pull request

Run the review of the current branch with the `sef:foundation-reviewer` agent
and act on its report according to the project's workflow mode.

## Steps

1. Check that `.engineering-foundation.yml` exists. Without it the project is
   not a foundation project: say so and stop.
2. Determine the workflow mode: the `workflow` field of the feature plan's
   front matter when the branch has a plan, otherwise `workflow` in
   `.engineering-foundation.yml`.
3. Make sure the branch is committed. Uncommitted changes are not reviewed;
   ask whether to commit them first.
4. Start the `sef:foundation-reviewer` agent in the foreground with the plan
   path, if any, and the base branch if the user named one. It needs no other
   context: give it none from this conversation, so it reviews the code and
   not the intentions behind it.
5. Act on the report:
   - **assisted**: show the report. The person decides what to change. Do not
     start fixing "Must fix" items on your own.
   - **autonomous**: fix every "Must fix" item, commit, and run the reviewer
     again, at most three rounds in total. Stop early when "Must fix" is empty.
     If items remain after the third round, stop and hand them to the person
     with the last report. Never resolve a "To decide" item yourself: list it
     for the person in every mode.
6. When the review is clean, run `corepack yarn premerge` and give the person
   the commit from its last line and a pull request description built from the
   plan's "Pull request description" section and the reviewer's "Passed"
   paragraph.
