import { readFile, readdir } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aiSdkProvider, decompose } from "@tier-reader/core";
import type { Plugin } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(HERE, "../../../packages/core/test/fixtures");

export function decomposeApiPlugin(): Plugin {
  return {
    name: "tier-reader-playground-api",
    configureServer(server) {
      server.middlewares.use("/api/fixtures", async (req, res, next) => {
        try {
          if (req.method !== "GET") return next();
          const url = new URL(req.url ?? "/", "http://x");
          const name = url.pathname.replace(/^\/+/, "");
          if (!name) {
            const files = (await readdir(FIXTURES_DIR)).filter((f) => f.endsWith(".txt")).sort();
            return sendJson(res, 200, { fixtures: files });
          }
          if (!/^[a-z0-9_-]+\.txt$/i.test(name)) {
            return sendJson(res, 400, { error: "invalid fixture name" });
          }
          const text = await readFile(resolve(FIXTURES_DIR, name), "utf8");
          res.statusCode = 200;
          res.setHeader("content-type", "text/plain; charset=utf-8");
          res.end(text);
        } catch (err) {
          sendJson(res, 500, { error: errMsg(err) });
        }
      });

      server.middlewares.use("/api/decompose", async (req, res, next) => {
        if (req.method !== "POST") return next();
        try {
          if (!process.env.ANTHROPIC_API_KEY) {
            return sendJson(res, 400, {
              error:
                "ANTHROPIC_API_KEY not set on the dev server. Add it to apps/playground/.env.local and restart.",
            });
          }
          const body = await readBody(req);
          const parsed = JSON.parse(body) as {
            input?: unknown;
            model?: unknown;
            respectStructure?: unknown;
          };
          if (typeof parsed.input !== "string" || !parsed.input.trim()) {
            return sendJson(res, 400, { error: "input must be a non-empty string" });
          }
          const provider = aiSdkProvider();
          const tree = await decompose(parsed.input, {
            provider,
            ...(typeof parsed.model === "string" ? { model: parsed.model } : {}),
            ...(typeof parsed.respectStructure === "boolean"
              ? { respectStructure: parsed.respectStructure }
              : {}),
          });
          sendJson(res, 200, { tree });
        } catch (err) {
          sendJson(res, 500, { error: errMsg(err) });
        }
      });
    },
  };
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
