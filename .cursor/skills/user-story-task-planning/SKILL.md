---
name: user-story-task-planning
description: >-
  Drafts user stories with clear value, acceptance criteria, and plannable
  work slices for backlog and sprint planning. Use when the user asks for user
  stories, backlog items, requirements in story form, acceptance criteria,
  epic breakdown, or planning tasks from a feature or idea.
---

# User stories and task planning

## When to apply this skill

Use it when the user wants user stories, backlog items, epic breakdown, acceptance criteria, or when an idea should become concrete, plannable work.

**Language:** Write stories and acceptance criteria in the same language the user uses.

## Workflow

1. **Clarify value:** Who benefits, and which problem or outcome is addressed? Ask at most 2–3 focused follow-ups only if goals, role, or constraints are unclear.
2. **Bound scope:** One story = one deliverable slice of user or business value (or technical value with a clear “why”). Split broad asks.
3. **Draft the story** using the template below.
4. **Acceptance criteria:** Testable and unambiguous. Include at least one happy path and typical errors/edge cases where relevant.
5. **Task slicing:** Propose 1–5 tasks that can be estimated and done independently where possible; note dependencies.
6. **Unknowns:** List open questions and assumptions explicitly (do not silently guess).

## Quality bar (INVEST — short)

**I**ndependent where feasible; **N**egotiable scope; **V**aluable to user or business; **E**stimable; **S**mall enough for a sprint; **T**estable via acceptance criteria.

## User story template

```markdown
## [ID or short title]

**Title:** [Action] for [role] so that [value/outcome]

**Description (optional):** [Context, constraints, links]

**As a** [role/persona]  
**I want** [capability/behaviour]  
**So that** [goal/value/outcome]

### Acceptance criteria
- [ ] [Criterion 1 — testable]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

### Out of scope (optional)
- …

### Tasks (planning)
| # | Task | Type (dev/design/test/docs) | Dependencies |
|---|------|-----------------------------|--------------|
| 1 | … | … | … |

### Estimate / risk (optional)
- **Complexity:** (S/M/L or story points if the team uses them)
- **Risk / uncertainty:** …

### Open questions
- …
```

## Acceptance criteria — format

Pick one format and stay consistent within the same deliverable:

**Checklist (simplest):**
`- [ ] When … then …`

**Given / When / Then (BDD):**
```text
Scenario: …
  Given …
  When …
  Then …
```

## Task planning

- Prefer a vertical slice (something demonstrable) when it fits the product.
- Split by layer (API-only, UI-only) only when it reduces risk or blocking dependencies require it.
- Each task needs a clear “done” signal (build green, tests pass, review, docs updated, etc.).

## What to deliver

Return ready-to-use markdown (one or many stories). For many stories: add a short overview (epic name, title list) before the details.
