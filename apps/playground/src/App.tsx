import type { Node, NodeId, Tree } from "@tier-reader/core";
import { useEffect, useState } from "react";
import { fetchDecompose, fetchFixture, fetchFixtures } from "./api.js";

type ViewMode = "discovery" | "overview" | "full";

export function App() {
  const [fixtures, setFixtures] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [input, setInput] = useState<string>("");
  const [tree, setTree] = useState<Tree | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [overrides, setOverrides] = useState<Map<NodeId, boolean>>(new Map());
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [respectStructure, setRespectStructure] = useState(false);

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
      const t = await fetchDecompose(input, { respectStructure });
      setTree(t);
      setOverrides(new Map());
      setStatus(`decomposed in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
    } catch (e) {
      setStatus(`decompose: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function changeMode(m: ViewMode) {
    setViewMode(m);
    setOverrides(new Map());
  }

  function defaultExpanded(depth: number): boolean {
    if (viewMode === "discovery") return false;
    if (viewMode === "full") return true;
    return depth === 0;
  }

  function isExpanded(node: Node): boolean {
    const ov = overrides.get(node.id);
    if (ov !== undefined) return ov;
    return defaultExpanded(node.depth);
  }

  function toggle(nodeId: NodeId, current: boolean) {
    const next = new Map(overrides);
    next.set(nodeId, !current);
    setOverrides(next);
  }

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
          <label className="opt">
            <input
              type="checkbox"
              checked={respectStructure}
              onChange={(e) => setRespectStructure(e.target.checked)}
            />
            <span>respect source structure (paragraphs, sections)</span>
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste text or pick a fixture…"
            spellCheck={false}
          />
        </section>

        <section className="pane tree-pane">
          <div className="row">
            <div className="mode-group" role="tablist" aria-label="display level">
              {(["discovery", "overview", "full"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={viewMode === m}
                  className={viewMode === m ? "mode active" : "mode"}
                  onClick={() => changeMode(m)}
                >
                  {m[0]?.toUpperCase()}
                  {m.slice(1)}
                </button>
              ))}
            </div>
            <span className="hint">click any title to toggle</span>
          </div>
          {tree ? (
            <ul className="tree">
              {tree.rootIds.map((rid) => (
                <NodeView
                  key={rid}
                  tree={tree}
                  nodeId={rid}
                  isExpanded={isExpanded}
                  onToggle={toggle}
                />
              ))}
            </ul>
          ) : (
            <p className="empty">No tree yet.</p>
          )}
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

function NodeView({
  tree,
  nodeId,
  isExpanded,
  onToggle,
}: {
  tree: Tree;
  nodeId: NodeId;
  isExpanded: (node: Node) => boolean;
  onToggle: (nodeId: NodeId, current: boolean) => void;
}) {
  const node = tree.nodes[nodeId];
  if (!node) return null;
  const expanded = isExpanded(node);
  const hasChildren = node.hasChildren;

  return (
    <li
      style={{ paddingLeft: `${node.depth * 1.25}rem` }}
      className={hasChildren ? "branch" : "leaf"}
    >
      <button
        type="button"
        className="title-btn"
        onClick={() => onToggle(nodeId, expanded)}
        aria-expanded={expanded}
      >
        <span className={`chevron ${expanded ? "open" : ""}`}>▾</span>
        <span className="title">{node.title}</span>
      </button>
      {expanded && hasChildren && (
        <ul className="tree">
          {(node.childIds ?? []).map((cid) => (
            <NodeView
              key={cid}
              tree={tree}
              nodeId={cid}
              isExpanded={isExpanded}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
      {expanded && !hasChildren && node.detail && <div className="detail">{node.detail}</div>}
    </li>
  );
}
