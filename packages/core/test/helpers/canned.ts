import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RawTree } from "../../src/schema.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(here, "../fixtures");

export function loadFixture(name: string): string {
  return readFileSync(resolve(fixturesDir, `${name}.txt`), "utf8");
}

export const CANNED: Record<string, RawTree> = {
  "wikipedia-paragraph": {
    roots: [
      {
        title:
          "Photosynthesis converts light into chemical energy in plant chloroplasts, releasing oxygen.",
        kind: "definition",
        tags: ["biology"],
        children: [
          {
            title:
              "Photosynthesis is the energy-conversion process plants use to turn light into chemical bonds.",
            detail:
              "Photosynthesis is the process by which plants convert light energy into chemical energy.",
            kind: "definition",
          },
          {
            title:
              "The reaction runs inside chloroplasts, organelles that house the green pigment chlorophyll.",
            detail: " It occurs in chloroplasts, organelles containing the pigment chlorophyll.",
            kind: "claim",
            entities: ["chloroplasts", "chlorophyll"],
          },
          {
            title: "Glucose is produced and oxygen is released as a byproduct of the reaction.",
            detail: " The process produces glucose and releases oxygen as a byproduct.",
            kind: "claim",
          },
        ],
      },
    ],
  },

  "ai-chat-answer": {
    roots: [
      {
        title:
          "Debouncing wraps a function so rapid repeated calls collapse into a single delayed execution.",
        kind: "procedure",
        tags: ["javascript"],
        children: [
          {
            title:
              "A debounced wrapper merges burst calls into one execution that fires after the caller goes quiet.",
            detail:
              "To debounce a function in JavaScript, wrap it so that repeated calls within a short window collapse into a single execution.",
            kind: "definition",
          },
          {
            title:
              "Implementation uses a closure that holds the pending timer id across invocations.",
            detail: " Create a closure holding a timer id.",
            kind: "procedure",
          },
          {
            title:
              "Each call clears the prior timer and schedules a new one for the wrapped function.",
            detail:
              " On each call, clear the previous timer and schedule a new one that invokes the wrapped function after the delay.",
            kind: "procedure",
          },
          {
            title: "Net effect is one execution per quiet period after activity stops.",
            detail:
              " The result is a function that only fires once the caller stops invoking it for the configured interval.",
            kind: "claim",
          },
        ],
      },
    ],
  },

  "tech-doc-snippet": {
    roots: [
      {
        title:
          "HTTP cache uses memory and disk tiers, checked in order, with bounded eviction policies.",
        kind: "definition",
        tags: ["caching", "http"],
        children: [
          {
            title:
              "Two-tier design splits responsibility between fast in-memory and durable on-disk storage.",
            detail: "The HTTP cache uses a two-tier strategy.",
            kind: "claim",
          },
          {
            title:
              "Memory tier holds recent responses for low-latency reads, bounded by an LRU policy.",
            detail:
              " The memory tier holds recent responses for fast retrieval and is bounded by an LRU policy.",
            kind: "claim",
          },
          {
            title:
              "Disk tier persists larger payloads across restarts, bounded by a total-bytes cap.",
            detail:
              " The disk tier persists larger payloads across restarts and is bounded by total bytes.",
            kind: "claim",
          },
          {
            title: "Reads probe memory, then disk, then fall through to the network on miss.",
            detail: " Reads check memory first, then fall back to disk, then to the network.",
            kind: "procedure",
          },
          {
            title: "Writes populate both tiers when response headers permit caching.",
            detail:
              " Writes populate both tiers when a response is cacheable per the response headers.",
            kind: "procedure",
          },
        ],
      },
    ],
  },

  "short-essay": {
    roots: [
      {
        title:
          "Reading dense text efficiently is a navigation problem solved by surfacing structure first.",
        kind: "claim",
        tags: ["reading", "ux"],
        children: [
          {
            title:
              "Effective reading of dense material is fundamentally a navigation problem, not a parsing one.",
            detail: "Reading dense text well is mostly a navigation problem.",
            kind: "claim",
          },
          {
            title: "Most prose is scaffolding around a small number of load-bearing sentences.",
            detail:
              " Most of what an author writes is scaffolding for the few sentences that carry real load.",
            kind: "claim",
          },
          {
            title:
              "Readers who locate load-bearing sentences quickly extract more value per minute.",
            detail:
              " The reader who can find those sentences quickly extracts more value per minute than one who reads linearly.",
            kind: "claim",
          },
          {
            title:
              "Tools that show structure before content let readers allocate attention deliberately.",
            detail:
              " Tools that surface structure before content let you choose where to invest attention.",
            kind: "claim",
          },
        ],
      },
    ],
  },

  "list-heavy": {
    roots: [
      {
        title: "Good code review evaluates correctness, clarity, scope, and risk of the change.",
        kind: "claim",
        tags: ["engineering", "review"],
        children: [
          {
            title: "Code review covers four dimensions, applied together rather than in isolation.",
            detail: "A good code review checks four things.",
            kind: "claim",
          },
          {
            title:
              "Correctness asks whether the change does what it claims and handles edge cases.",
            detail:
              " First, correctness: does the change do what it claims, and are the edge cases handled.",
            kind: "claim",
          },
          {
            title:
              "Clarity asks whether a future reader can follow the code without git archaeology.",
            detail:
              " Second, clarity: will a future reader understand the code without archaeology.",
            kind: "claim",
          },
          {
            title: "Scope asks whether the change is focused or smuggles unrelated work alongside.",
            detail: " Third, scope: is the change focused, or does it bundle unrelated work.",
            kind: "claim",
          },
          {
            title: "Risk asks what could break and whether the blast radius is acceptable.",
            detail: " Fourth, risk: what could break, and is the blast radius acceptable.",
            kind: "claim",
          },
        ],
      },
    ],
  },
};

export const FIXTURE_NAMES = Object.keys(CANNED);
