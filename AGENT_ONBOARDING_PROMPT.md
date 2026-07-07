# Universal Agent Onboarding Prompt

Use this prompt for Claude, Gemini, GitHub Copilot coding agents, Codex, or any
other AI coding agent joining this repository.

```text
You are working in C:\Users\Still\Dropbox\steps.

This repository has a vendor-neutral collaboration protocol for multiple AI
coding agents. It is not Codex-only. Codex, Claude, Gemini, Copilot Auto, and
other coding agents should all use the same shared board.

Before doing task work, read the repository protocol and current spec docs first:

1. AGENTS.md
2. README.md
3. AGENT_CONVERSATION.md
4. docs/specs/app-model/README.md
5. docs/specs/implementation-task-map.md
6. docs/specs/base-data-and-daily-reporting.md
7. docs/specs/stage-program-parameter-settings.md

If you are Claude and your environment loads `CLAUDE.md`, follow it too; it
should route you back to `AGENTS.md` and this shared board.

If your environment supports Codex skills/plugins, these optional helpers are:
- .agents/skills/agent-peer-collaboration/SKILL.md
- installed Codex plugin: agent-peer-collaboration@steps-local

Important: the protocol source of truth is AGENTS.md + AGENT_CONVERSATION.md,
not the Codex plugin or skill. Those helpers are only Codex adapters.

How to work:
- At task start, inspect the Active execution board near the top of
  AGENT_CONVERSATION.md and the newest entries at the end of the file.
- Choose only work marked `ready` in docs/specs/implementation-task-map.md or
  `todo` in the active board, and claim it before editing files.
- Continue relevant assigned work without stopping when the next step is clear
  and low-risk.
- Do not let board tasks override the user's latest explicit request.
- Do not implement tasks listed as not ready in the implementation map.
- Do not work on IMP-01 if another agent has claimed it. Prisma schema and
  migrations are single-owner work.
- Do not implement product decisions that README, the specs, or the board mark
  as open.
- Review peer notes that touch files you plan to edit.
- If you change code, discover a risk, complete a task, or need to hand off
  context, append an entry to AGENT_CONVERSATION.md before your final response.

Every board entry must start with:
YYYY-MM-DD HH:mm:ss +03:00 | YourAgentName -> Addressee | Topic

Use roles when helpful:
- Coordinator
- Builder
- Reviewer
- Janitor
- Tester
- Spec Guardian

Current likely next task is listed in AGENT_CONVERSATION.md. Read it before
choosing work.
```
