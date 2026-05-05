import type { Tree } from "@tier-reader/core";
import { renderAt } from "@tier-reader/core/render";
import { useEffect, useMemo, useState } from "react";
import { fetchDecompose, fetchFixture, fetchFixtures } from "./api.js";

export function App() {
  const [fixtures, setFixtures] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [input, setInput] = useState<string>("");
  const [tree, setTree] = useState<Tree | null>(null);
  const [depth, setDepth] = useState(2);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    fetchFixtures()
      .then(setFixtures)
      .catch((e) => setStatus(`load fixtures: ${e.message}`));
  }, []);

  async function loadFixture(name: string) {
    setSelected(name);
    if (!name) return;
    try {
      const text = await fetchFixture(name);
      setInput(text);
      setStatus(`loaded ${name}`);
    } catch (e) {
      setStatus(`load: ${(e as Error).message}`);
    }
  }

  async function onDecompose() {
    if (!input.trim()) {
      setStatus("input empty");
      return;
    }
    setBusy(true);
    setStatus("decomposing…");
    const t0 = performance.now();
    try {
      const t = await fetchDecompose(input);
      setTree(t);
      setStatus(`decomposed in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
    } catch (e) {
      setStatus(`decompose: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const plan = useMemo(() => {
    if (!tree) return [];
    const rootId = tree.rootIds[0];
    if (!rootId) return [];
    return renderAt(tree, rootId, depth);
  }, [tree, depth]);

  return (
    <div className="layout">
      <header>
        <h1>tier-reader playground</h1>
        <span className="status">{status}</span>
      </header>
      <main>
        <section className="pane input-pane">
          <div className="row">
            <label>
              Fixture:{" "}
              <select value={selected} onChange={(e) => loadFixture(e.target.value)}>
                <option value="">(none)</option>
                {fixtures.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={onDecompose} disabled={busy}>
              {busy ? "…" : "Decompose"}
            </button>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste text or pick a fixture…"
            spellCheck={false}
          />
        </section>

        <section className="pane tree-pane">
          <div className="row">
            <label>
              Depth: {depth}
              <input
                type="range"
                min={0}
                max={6}
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
              />
            </label>
          </div>
          <TreeView tree={tree} plan={plan} />
        </section>

        <section className="pane json-pane">
          <button type="button" onClick={() => setShowJson((v) => !v)}>
            {showJson ? "Hide" : "Show"} raw JSON
          </button>
          {showJson && tree && <pre>{JSON.stringify(tree, null, 2)}</pre>}
        </section>
      </main>
    </div>
  );
}

function TreeView({
  tree,
  plan,
}: {
  tree: Tree | null;
  plan: ReturnType<typeof renderAt>;
}) {
  if (!tree) return <p className="empty">No tree yet.</p>;
  return (
    <ul className="tree">
      {plan.map(({ nodeId, indent, showDetail }) => {
        const node = tree.nodes[nodeId];
        if (!node) return null;
        return (
          <li
            key={nodeId}
            style={{ paddingLeft: `${indent * 1.25}rem` }}
            className={node.hasChildren ? "branch" : "leaf"}
          >
            <span className="title">{node.title}</span>
            {showDetail && node.detail && <div className="detail">{node.detail}</div>}
          </li>
        );
      })}
    </ul>
  );
}
