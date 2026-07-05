---
name: agent-peer-collaboration
description: Coordinate multiple AI coding agents from any vendor through AGENT_CONVERSATION.md. Use when an agent needs to read or write the shared peer work board, assign or continue tasks, perform peer review, prune stale notes, plan roles, or preserve handoff context while continuing implementation without unnecessary stops.
---

# Agent Peer Collaboration

Use `AGENT_CONVERSATION.md` as the shared work board for parallel AI coding agents across Codex, Claude, Gemini, Copilot Auto, and similar tools.

This skill is a Codex-facing adapter for the repository protocol. The source of truth is `AGENTS.md` plus `AGENT_CONVERSATION.md`; if this skill conflicts with those files, follow the repo files and record the mismatch on the board when useful.

## Core workflow

1. Read `AGENT_CONVERSATION.md` before task work when it exists.
2. Identify entries addressed to your agent name, your current role, or `Any agent`.
3. Continue assigned work when it is relevant to the user's latest request and safe to do.
4. Treat explicit user instructions as higher priority than peer-board tasks.
5. Before the final response, append a new entry only if it adds useful coordination value.

## Vendor adapters

- Codex: use this skill or the installed plugin when available.
- Claude: read `CLAUDE.md`, then `AGENTS.md`, then `AGENT_CONVERSATION.md`.
- Gemini and Copilot Auto: read `AGENT_ONBOARDING_PROMPT.md` or receive it as the startup prompt.
- Other agents: read `AGENTS.md` and `AGENT_CONVERSATION.md`; follow the entry format and task board.

The protocol is vendor-neutral. Do not assume entries are only for Codex.

## Entry format

Every entry must start with:

```text
YYYY-MM-DD HH:mm:ss +03:00 | Author -> Addressee | Topic
```

Use the local Asia/Jerusalem time shown by the environment when possible.

## Roles

- `Coordinator`: Reads all notes, assigns next tasks, resolves priority conflicts, and keeps the board moving.
- `Builder`: Implements scoped application changes and records handoff context.
- `Reviewer`: Reviews peer changes for bugs, regressions, missing tests, and spec drift.
- `Janitor`: Finds stale work, obsolete notes, duplicated logic, and legacy code that should be removed or consolidated.
- `Tester`: Adds or runs focused verification, proposes test strategy, and reports coverage gaps.
- `Spec Guardian`: Checks that implementation matches README, AGENTS.md, schema comments, and explicit product decisions.

One agent may hold multiple roles in a turn, but should name the active role in the entry topic when useful.

## Board discipline

- Assign tasks as small, concrete actions with target files when possible.
- Mark tasks `todo`, `doing`, `blocked`, `done`, or `obsolete`.
- Do not delete peer history. If a task is stale, add an `obsolete` note explaining why.
- Do not silently implement product decisions marked open in README or the board.
- If a peer assigns work that conflicts with the latest user request, follow the user and record the conflict if useful.

## Good entry types

- Peer review with file references and suggested fixes.
- Handoff after partial work.
- Task assignment from Coordinator to a role or named agent.
- Blocker requiring product input.
- Janitor note marking legacy/stale work obsolete.
- Tester note reporting verification run and remaining gaps.

## Avoid

- Appending boilerplate "nothing to add" entries.
- Rewriting the board after every minor edit.
- Treating the board as a hidden backlog that expands the user's requested scope without judgment.
