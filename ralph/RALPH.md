# Instructions

Using the `/opsx-apply` command, implement ONLY the next pending incomplete task for change {{CHANGE_ID}}. Do not await further approval, proceed directly with implementation of the next task.

## Your Task

1. Read `progress.txt` if it exists (check the **Codebase Patterns** section first); create it if absent
2. Use the `/opsx-apply` command to implement this session's task (see **Task Selection and Execution** below)
3. Add or update tests as needed to cover every change made
4. Run **ALL** project tests (not just new or changed tests) using the project's existing test runner
5. Update `AGENTS.md` and other relevant documentation files if you discover reusable patterns (see below)
6. Once ALL tests pass, append your progress to `progress.txt` (see below)
7. Commit ALL changes with message: `Completed {{CHANGE_ID}} task #<ID> - <short ~5-15 word summary of task>`
8. Check whether all tasks in `tasks.md` are complete

## Task Selection and Execution

First, determine the nesting depth `n` of the task list (e.g., a flat numbered list is depth 1; adding `.1` subtasks makes it depth 2; `.1.1` leaf items make it depth 3, etc.).

Execute **one task at depth n−1** per session — that is, one level above the leaf items:
- **Depth-2 list** (top-level tasks with subtasks): complete one top-level task per session
- **Depth-3 list** (e.g., subtasks `1.1`, `1.2`, etc. under a `## 1` heading): complete one second-level task per session
- **Depth-4+ list**: apply the same rule — work at one level above the deepest leaf items

Always execute the lowest-numbered incomplete task at that target depth. A task is only complete when **all of its children** are finished and all tests pass.

## Progress Report Format

APPEND to `progress.txt` (never replace, always append):

```
## [Date/Time] - {{CHANGE ID}} Task [N]: [Task Title]
- What was implemented
- Subtasks completed: [N.1], [N.2], ...
- Files changed
- Tests added/updated
- **Learnings for future iterations:**
  - Patterns discovered (e.g., "this codebase uses X for Y")
  - Gotchas encountered (e.g., "don't forget to update Z when changing W")
  - Useful context (e.g., "the evaluation logic lives in module X")
---
```

**NOTE: insert date as YYYY-MM-DD and time as HH:MM:SS for [Date/Time] in the progress update**

Include concise summaries only in the learnings section, and avoid redundancy.

## Consolidate Patterns

If you discover a **reusable pattern** that future iterations should know, add it to the `## Codebase Patterns` section at the **top** of `progress.txt` (create the section if it does not exist):

```
## Codebase Patterns
- Example: Use `X` pattern for all `Y` operations
- Example: Always update `Z` when changing `W`
- Example: Tests require the dev server running on PORT 3000
```

Only add patterns that are **general and reusable**, not task-specific details.

## Update `AGENTS.md` Files

Before committing, check if any edited files have learnings worth preserving in nearby `AGENTS.md` files or other project documentation:

1. **Identify directories with edited files** — look at which directories you modified
2. **Check for existing `AGENTS.md`** — look in those directories and their parent directories
3. **Add valuable learnings** if you discovered something future developers or agents should know:
   - API patterns or conventions specific to that module
   - Gotchas or non-obvious requirements
   - Dependencies between files
   - Testing approaches for that area
   - Configuration or environment requirements

**Examples of good `AGENTS.md` additions:**
- "When modifying X, also update Y to keep them in sync"
- "This module uses pattern Z for all API calls"
- "Field names must match the template exactly"

**Do NOT add:**
- Task-specific implementation details
- Temporary debugging notes
- Information already in `progress.txt`
- Information already covered by existing project documentation (`docs/`, technical guides, etc.)

Only update `AGENTS.md` or other technical documents if you have **genuinely reusable knowledge** that is not already documented and would help future work in that directory.

## Quality Requirements

- ALL commits must pass the project's quality checks (typecheck, lint, test)
- Do NOT commit broken code
- Keep changes focused and minimal — stay in scope for the current task
- Follow existing code patterns and style

## Stop Condition

After completing a task, read `tasks.md` for `{{CHANGE_ID}}`. If ALL tasks are fully complete (all items marked with `[x]`), then reply with:

```
<promise>COMPLETE</promise>
```

If there are still incomplete tasks, end your response normally — another iteration will pick up the next task.

## Important

- Work on **ONE task at depth n−1 per iteration** (see **Task Execution**)
- Complete **all children** of that task before committing
- Ensure **ALL project tests pass** before committing
- Read `progress.txt` before starting (check Codebase Patterns section); create it if absent
- Keep commits focused and the branch green at all times
