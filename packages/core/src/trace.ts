import { Langfuse } from "langfuse";

let client: Langfuse | null = null;
let initialized = false;

function getClient(): Langfuse | null {
  if (initialized) return client;
  initialized = true;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  if (!publicKey || !secretKey) return null;
  client = new Langfuse({
    publicKey,
    secretKey,
    baseUrl: process.env.LANGFUSE_BASE_URL,
  });
  return client;
}

export interface TraceContext {
  name: string;
  model?: string;
  input: unknown;
}

export async function withTrace<T>(ctx: TraceContext, fn: () => Promise<T>): Promise<T> {
  const lf = getClient();
  if (!lf) return fn();

  const trace = lf.trace({ name: ctx.name, input: ctx.input });
  const generation = trace.generation({
    name: ctx.name,
    model: ctx.model,
    input: ctx.input,
  });
  try {
    const out = await fn();
    generation.end({ output: out });
    return out;
  } catch (err) {
    generation.end({ output: { error: String(err) }, level: "ERROR" });
    throw err;
  } finally {
    await lf.flushAsync().catch(() => {});
  }
}
