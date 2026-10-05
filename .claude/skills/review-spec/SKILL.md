---
name: review-spec
description: Check whether a spec is ready to implement. Use when the user asks to review a spec, or asks "do you have what you need to implement NNN?". Read-only; changes neither the spec nor the code.
argument-hint: <spec number>
---

Review spec $ARGUMENTS for readiness. Change nothing.

1. Read the spec, then the code and tests it names. Check every file, function, route and field it mentions still exists under that name; specs written before a rename go stale.
2. Check it against the invariants in `AGENTS.md` and the earlier specs it builds on. A spec that contradicts one of them has to say so and say why.
3. Look for what's missing:
   - an acceptance criterion with no way to verify it
   - behavior left undefined: empty states, past months (read-only), a removed member, a member who isn't an owner, both themes
   - a schema change with no migration note, or one that breaks backup/restore (`schemaVersion` in `src/lib/backup.ts`)
   - a Documentation section that doesn't match what the change touches
4. Answer in this order:
   - **Ready or not**, in one line.
   - **Blocking gaps**: each with a recommended resolution, so the user can reply "go with your recs".
   - **Smaller suggestions**: optional, one line each.
   - **Plan**: the files you'd change and the tests you'd add, in order.

Don't edit the spec, flip its status, or start implementing until the user says so.
