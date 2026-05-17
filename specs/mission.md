# Mission

## What we're building

**tier-reader** — a recursive progressive-disclosure text decomposition engine that breaks dense text into a tree where each title is an info-dense one-liner you can *learn from*, and leaves preserve the verbatim source. Reading collapses or expands branches by depth.

The same engine powers two distinct kinds of consumer:

- **Human reader** (Wikipedia articles, long-form content, AI chat output) — progressive disclosure as a reading UX.
- **Machine consumer** (multi-agent context routing) — per-agent context slices at the right tier.

## Why — dual-purpose

This project is **dual-purpose**. When the two purposes conflict, primary wins.

- **Primary: portfolio.** Visible AI-app-dev work targeting roles in agentic systems, context engineering, and AI infrastructure. Architectural decisions get judged against "would this be defensible in a senior interview?"
- **Secondary: personal use.** Reading dense text (Wikipedia, technical docs, AI chat output) more efficiently. Polish bar = "works for me," no shippable-product expectations.

Conflict resolution: portfolio wins. Concrete example — extension polish bar: personal use accepts a hand-rolled options page; portfolio is satisfied if the LinkedIn post lands. We optimize for the post landing, not Web Store quality.

## Audience

- **Developers** consuming `@tier-reader/core` and `context-compiler` as NPM libraries (public README, working examples, install-and-run).
- **Self** as the only end-user of the Chrome extension.
- **Hiring side** — recruiters / hiring managers / dev leads reading the LinkedIn posts and clicking through to repos.

## Deliverables

Four numbered deliverables, built in order:

- **A — `@tier-reader/core` engine.** Schema, `decompose`, `route`, `compile`, `renderAt`. Framework-agnostic. The substrate everything else builds on.
- **B — `context-compiler` library + benchmark + LinkedIn post #1.** Multi-agent context routing built on the engine. Benchmark vs flat broadcast at N=3, 5, 10 agents. Blog post documents methodology and results.
- **C — `@tier-reader/react` renderer.** Migrates the existing `tier-reader.jsx` prototype onto the engine.
- **D — Chrome extension + LinkedIn post #2.** Personal-use-bar Wikipedia / docs reader. Loads the React renderer in-page. BYOK. Post documents the engineering of in-page integration.

## Success criteria

- All four deliverables shipped to GitHub, with `core` and `context-compiler` published to NPM.
- **LinkedIn post #1** (context-compiler benchmark) published.
- **LinkedIn post #2** (extension demo) published.

That's it. No engagement, install-count, or inbound-contact thresholds. **Done = done.**

## Out of scope (v1)

- Streaming generation (model emits nodes one-by-one). Deferred until extension UX warrants — see `roadmap.md` § Deferred.
- Standalone AI-chat-display package. Folded into `core` + `react` consumers; not its own deliverable.
- Multi-language source support beyond English. Schema is language-agnostic; engine prompts are not.
- Server-side API key proxy for the extension. BYOK only.
- Web Store listing for the extension. Side-load only.
- Multi-provider model abstraction beyond Vercel AI SDK + BYO escape hatch. No OpenRouter wrapper, no LangChain, no LiteLLM at engine level.

## Open questions

- [phase 4] **Final framing for LinkedIn post #1** — "multi-agent context routing" vs "sub-turn context slicing for skills/subagents/specialists." The trend in 2026 has moved away from explicit agent orchestration (DACS, AutoGen) toward one-capable-agent-with-many-skills (Anthropic Skills, Claude Code subagents, OpenAI Agents SDK). The underlying context-slicing problem is identical; only the wrapper vocabulary changes. Settle final wording at Phase 4 post-drafting time. Implementation in Phase 3 is framing-neutral (`AgentSpec` is just a struct).
- [post-v1] **Standalone AI-chat-display package** — pull in only if an external consumer use case appears.
