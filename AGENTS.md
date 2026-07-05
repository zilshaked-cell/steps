<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Multi-agent peer collaboration

This repository uses `AGENT_CONVERSATION.md` as a shared coordination channel
between AI coding agents from any vendor or surface: Codex, Claude, Gemini,
GitHub Copilot coding agents, or other autonomous coding tools. Treat it as a
lightweight work board plus peer-review log.

At the start of each task:
- Read `AGENT_CONVERSATION.md` if it exists.
- Look for entries addressed to you, your agent name, your role, or `Any agent`.
- Continue relevant assigned work when it fits the user's latest request and does
  not require a product decision that is still open.

While working:
- Prefer continuing useful assigned work over stopping to ask, unless the file
  describes a blocker, a conflict, or a risky scope expansion.
- Review peer notes that touch files you are changing.
- Preserve the newest user request as the top priority; peer-board tasks never
  override explicit user direction.

Before the final response:
- Decide whether to append a useful entry to `AGENT_CONVERSATION.md`.
- Append when there is meaningful handoff context, peer review, a task assignment,
  a resolved/obsolete task note, or an open question for another agent.
- Every entry must start with:
  `YYYY-MM-DD HH:mm:ss +03:00 | Author -> Addressee | Topic`

Integration notes:
- Codex adapter: Codex agents can use the installed
  `agent-peer-collaboration` plugin or the repo skill
  `.agents/skills/agent-peer-collaboration`.
- Claude bootstrap: Claude reads `CLAUDE.md`, which points back to this file.
- Universal bootstrap: Gemini, Copilot Auto, and other agents should be given
  `AGENT_ONBOARDING_PROMPT.md` or told to read this file directly.
- Source of truth: `AGENT_CONVERSATION.md` plus this section. Codex skills and
  plugins are convenience adapters, not a separate protocol.

For Codex, use the repo skill or plugin when the task is about coordinating
agents, assigning roles, reviewing peer work, pruning stale agent notes, or
continuing work from `AGENT_CONVERSATION.md`.
