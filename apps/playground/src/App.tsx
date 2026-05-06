import type { Node, NodeId, Tier, Tree } from "@tier-reader/core";
import { useEffect, useMemo, useState } from "react";
import { fetchDecompose, fetchFixture, fetchFixtures } from "./api.js";

type ViewStyle = "frontier" | "slice" | "verbatim";

// Mirrors DEFAULT_TIER_THRESHOLDS in @tier-reader/core. Kept inline because
// the core entry is Node-only; duplicating two constants is cheaper than
// pulling a browser-safe re-export through.
const TIER_PREVIEW_SMALL = 8_000;
const TIER_PREVIEW_MEDIUM = 40_000;

function previewTier(input: string): Tier {
  const n = input.length;
  if (n < TIER_PREVIEW_SMALL) return "small";
  if (n < TIER_PREVIEW_MEDIUM) return "medium";
  return "large";
}

function maxDepthOf(tree: Tree): number {
  let max = 0;
  for (const n of Object.values(tree.nodes)) if (n.depth > max) max = n.depth;
  return max;
}

function nodesAtDepth(tree: Tree, depth: number): Node[] {
  const visit = (id: NodeId, out: Node[]) => {
    const n = tree.nodes[id];
    if (!n) return;
    if (n.depth === depth) out.push(n);
    if (n.depth < depth) for (const c of n.childIds ?? []) visit(c, out);
  };
  const out: Node[] = [];
  for (const r of tree.rootIds) visit(r, out);
  return out;
}

function leavesInOrder(tree: Tree): Node[] {
  const out: Node[] = [];
  const visit = (id: NodeId) => {
    const n = tree.nodes[id];
    if (!n) return;
    if (!n.hasChildren) {
      out.push(n);
      return;
    }
    for (const c of n.childIds ?? []) visit(c);
  };
  for (const r of tree.rootIds) visit(r);
  return out;
}

export function App() {
  const [fixtures, setFixtures] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [input, setInput] = useState<string>("");
  const [tree, setTree] = useState<Tree | null>(null);
  const [viewStyle, setViewStyle] = useState<ViewStyle>("frontier");
  const [viewLayer, setViewLayer] = useState<number>(2); // 1-indexed; 2 ≈ old "Overview"
  const [overrides, setOverrides] = useState<Map<NodeId, boolean>>(new Map());
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [respectStructure, setRespectStructure] = useState(false);
  const [resolvedTier, setResolvedTier] = useState<Tier | null>(null);
  const [synthesisMerge, setSynthesisMerge] = useState(true);

  const inputTierPreview = useMemo(() => previewTier(input), [input]);
  const treeMaxLayer = useMemo(() => (tree ? maxDepthOf(tree) + 1 : 1), [tree]);

  useEffect(() => {
    fetchFixtures()
      .then(setFixtures)
      .catch((e) => setStatus(`load fixtures: ${e.message}`));
  }, []);

  // Clamp viewLayer when a new tree comes in.
  useEffect(() => {
    if (tree && viewLayer > treeMaxLayer) setViewLayer(treeMaxLayer);
  }, [tree, treeMaxLayer, viewLayer]);

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
      const { tree: t, tier } = await fetchDecompose(input, {
        respectStructure,
        ...(inputTierPreview === "large" ? { synthesisMerge } : {}),
      });
      setTree(t);
      setResolvedTier(tier);
      setOverrides(new Map());
      setStatus(`decomposed in ${((performance.now() - t0) / 1000).toFixed(1)}s (${tier})`);
    } catch (e) {
      setStatus(`decompose: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function changeStyle(s: ViewStyle) {
    setViewStyle(s);
    setOverrides(new Map());
  }

  function changeLayer(n: number) {
    setViewLayer(n);
    setOverrides(new Map());
  }

  // Frontier mode: show all titles up to selected layer.
  // A parent at depth d is expanded by default iff d < (viewLayer - 1).
  function defaultExpanded(parentDepth: number): boolean {
    return parentDepth < viewLayer - 1;
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
          <div className="row">
            <span className={`tier-badge tier-${resolvedTier ?? inputTierPreview}`}>
              tier: {resolvedTier ?? `${inputTierPreview} (predicted)`}
            </span>
            <span className="hint">{input.length.toLocaleString()} chars</span>
          </div>
          <label className="opt">
            <input
              type="checkbox"
              checked={respectStructure}
              onChange={(e) => setRespectStructure(e.target.checked)}
            />
            <span>respect source structure (paragraphs, sections)</span>
          </label>
          {inputTierPreview === "large" && (
            <label className="opt">
              <input
                type="checkbox"
                checked={synthesisMerge}
                onChange={(e) => setSynthesisMerge(e.target.checked)}
              />
              <span>synthesis merge (large tier: unify chunk roots into one outline)</span>
            </label>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste text or pick a fixture…"
            spellCheck={false}
          />
        </section>

        <section className="pane tree-pane">
          <div className="row controls-row">
            <div className="mode-group" role="tablist" aria-label="view style">
              {(["frontier", "slice", "verbatim"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={viewStyle === s}
                  className={viewStyle === s ? "mode active" : "mode"}
                  onClick={() => changeStyle(s)}
                  title={
                    s === "frontier"
                      ? "show all titles up to the selected layer"
                      : s === "slice"
                        ? "show only titles at the selected layer (flat, source order)"
                        : "show only the verbatim leaf text — no titles"
                  }
                >
                  {s[0]?.toUpperCase()}
                  {s.slice(1)}
                </button>
              ))}
            </div>
            {viewStyle !== "verbatim" && (
              <div className="layer-group" role="tablist" aria-label="layer depth">
                <span className="hint">layer:</span>
                {Array.from({ length: Math.max(1, treeMaxLayer) }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="tab"
                    aria-selected={viewLayer === n}
                    className={viewLayer === n ? "mode active" : "mode"}
                    onClick={() => changeLayer(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
            <span className="hint">click a title (or chevron) to toggle</span>
          </div>
          {tree ? (
            viewStyle === "verbatim" ? (
              <VerbatimView tree={tree} />
            ) : viewStyle === "slice" ? (
              <SliceView tree={tree} layer={viewLayer} />
            ) : (
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
            )
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

function copyText(text: string) {
  void navigator.clipboard.writeText(text);
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
      <div className="title-row">
        {hasChildren ? (
          <button
            type="button"
            className="chevron-btn"
            onClick={() => onToggle(nodeId, expanded)}
            aria-expanded={expanded}
            aria-label={expanded ? "collapse" : "expand"}
          >
            <span className={`chevron ${expanded ? "open" : ""}`}>▾</span>
          </button>
        ) : (
          <span className="chevron-spacer" aria-hidden="true" />
        )}
        <button
          type="button"
          className="title-btn"
          onClick={() => hasChildren && onToggle(nodeId, expanded)}
          aria-expanded={hasChildren ? expanded : undefined}
        >
          <span className="title">{node.title}</span>
        </button>
        <button
          type="button"
          className="copy-btn"
          title="copy"
          aria-label="copy node text"
          onClick={(e) => {
            e.stopPropagation();
            copyText(node.detail ? `${node.title}\n\n${node.detail}` : node.title);
          }}
        >
          ⧉
        </button>
      </div>
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

function SliceView({ tree, layer }: { tree: Tree; layer: number }) {
  const depth = layer - 1;
  const items = nodesAtDepth(tree, depth);
  if (items.length === 0) {
    return <p className="empty">No titles at layer {layer}.</p>;
  }
  return (
    <ul className="slice">
      {items.map((n) => (
        <li key={n.id} className={n.hasChildren ? "branch" : "leaf"}>
          <div className="title-row">
            <span className="chevron-spacer" aria-hidden="true" />
            <span className="title">{n.title}</span>
            <button
              type="button"
              className="copy-btn"
              title="copy"
              aria-label="copy node text"
              onClick={() => copyText(n.detail ? `${n.title}\n\n${n.detail}` : n.title)}
            >
              ⧉
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function VerbatimView({ tree }: { tree: Tree }) {
  const text = leavesInOrder(tree)
    .map((n) => n.detail ?? "")
    .join("");
  return (
    <div className="verbatim">
      <button type="button" className="copy-btn-inline" onClick={() => copyText(text)}>
        ⧉ copy all
      </button>
      <pre>{text}</pre>
    </div>
  );
}
