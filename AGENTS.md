# Universal AI Agent Handoff Protocol (Triple-Anchor Architecture)

This repository follows the **Triple-Anchor Multi-Agent Handoff Protocol** to ensure 100% continuous context and zero hallucination when switching between AI agents (Cursor, Claude Desktop, Antigravity, ChatGPT, Copilot, or custom CLIs).

---

## 🧭 Mandatory Rules for Every AI Agent

### 1. On Startup / Initialization (Ground Truth & Intent Check)
* **Check Git Status:** Run `git status` or inspect recent commits to understand the exact code state on disk.
* **Read the Living Plan:** Always inspect [`PLAN.md`](./PLAN.md) before performing any changes to understand:
  - Current objective and progress.
  - Architectural constraints and recent decisions.
  - The immediate next task.

### 2. During Execution (Safety & Clean State)
* **Preserve Integrity:** Do not remove existing error handling, comments, or architectural patterns without consulting the Decision Log.
* **Keep Code Operational:** Verify syntax and ensure the project remains cleanly executable at each milestone.

### 3. Before Finishing or When Quotas/Token Limits Approach (Handoff Checkpoint)
Whenever completing a phase or approaching session/token limits, execute the handoff sequence:
1. **Record Gotchas in Decision Log:** If you resolved a subtle bug or made an intentional design choice, document it under `## Decision Log & Gotchas` in [`PLAN.md`](./PLAN.md) so subsequent models do not undo your work.
2. **Update Checklist:** Mark completed items with `[x]` and clarify the immediate pending step with `[ ]`.
3. **Commit Code Checkpoint:** Create a clean Git commit with a concise message describing the milestone achieved:
   ```bash
   git add . && git commit -m "checkpoint: completed [feature/step], ready for [next step]"
   ```

---

## 🏗️ The Triple-Anchor Framework

```
┌───────────────────────────────────────────────────────────────┐
│ Anchor 1: AGENTS.md (Universal Agent Guardrail)               │
│ -> Mandates: "Inspect PLAN.md and Git before touching code"  │
└──────────────────────────────┬────────────────────────────────┘
                               │
       ┌───────────────────────┴───────────────────────┐
       ▼                                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│ Anchor 2: PLAN.md             │   │ Anchor 3: Git Status & Diff   │
│ (The Intent & Architecture)   │   │ (The Ground Truth of Code)    │
│ • Completed milestones        │   │ • Exact lines changed on disk │
│ • Immediate next pending task │   │ • Clean syntax state          │
│ • "Decision Log" & Gotchas    │   │ • Zero hallucinated files     │
└───────────────────────────────┘   └───────────────────────────────┘
```
