import { useState } from "react";

const MODELS = {
  haiku: { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
  sonnet: { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  opus: { id: "claude-opus-4-7", label: "Opus 4.7" },
};

export default function TierReader() {
  const [input, setInput] = useState("");
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("overview");
  const [overrides, setOverrides] = useState(new Map());
  const [model, setModel] = useState("haiku");

  const decompose = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const prompt = `Decompose the following text into a hierarchical tree for progressive disclosure reading.




Each node has:
- "title": ONE information-dense sentence that DELIVERS the chunk's actual gist, not a label.
  The reader should LEARN the thing from the title alone, not just learn that the thing exists.
  Write the shortest possible title that conveys the gist of the chunk, and use plain language.
  GOOD: "Physics: Study of matter and its motion through space-time."
  BAD: "Physics: A General Introduction"
  GOOD: "Einstein (1905): Explained the photoelectric effect via quantized light packets."
  BAD: "Einstein's contribution to quantum theory"
  GOOD: "Matter: Mass-bearing substance made of atoms; ranges from solid to plasma."
  BAD: "Matter is any substance with mass and volume, composed of atoms and subatomic particles, existing in phases from solid to plasma."
  GOOD: "Quantum Level: Matter lacks inherent size; fermions occupy space via the exclusion principle."
  BAD: "At the quantum level, matter has no inherent size or volume; fermions are forced apart by the exclusion principle, which produces the everyday appearance of matter occupying space."
- For PARENT nodes: "subsections": array of child nodes (same shape, recursive)
- For LEAF nodes: "content": the original verbatim source text for that section, EXACTLY as written. Do not paraphrase. Preserve sentences from the source.

A node has EITHER subsections OR content, never both.

Structure rules:
- Maximum 3 levels of depth
- Top level: 4-6 main sections covering the entire text
- Each parent: 2-5 children
- Leaves contain the actual original text for that subsection
- Together, all leaves' content concatenated in order should reconstruct the original text

Output ONLY a JSON object. No preamble, no markdown fences, no commentary.
Format: {"subsections": [...]}

Source text:
<text>
${input}
</text>`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODELS[model].id,
          max_tokens: 4000,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      const text = data.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      const clean = text.replace(/^```json\s*|^```\s*|```\s*$/gm, "").trim();
      const parsed = JSON.parse(clean);

      if (!parsed.subsections || !Array.isArray(parsed.subsections)) {
        throw new Error("Unexpected response shape");
      }

      setTree(parsed);
      setOverrides(new Map());
    } catch (e) {
      console.error(e);
      setError("Decomposition failed — JSON may have truncated. Try shorter text or a different model.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setTree(null);
    setInput("");
    setOverrides(new Map());
    setError(null);
    setViewMode("overview");
  };

  const pathKey = (p) => p.join(".");

  // Two-state per node: 0 = collapsed, 1 = expanded
  const defaultStateFor = (depth) => {
    if (viewMode === "discovery") return 0;
    if (viewMode === "overview") return depth === 0 ? 1 : 0;
    return 1; // full = everything expanded
  };

  const stateFor = (path, depth) => {
    const key = pathKey(path);
    if (overrides.has(key)) return overrides.get(key);
    return defaultStateFor(depth);
  };

  const toggleNode = (path, depth, e) => {
    e.stopPropagation();
    const current = stateFor(path, depth);
    const next = current === 0 ? 1 : 0;
    const newMap = new Map(overrides);
    newMap.set(pathKey(path), next);
    setOverrides(newMap);
  };

  const setMode = (m) => {
    setViewMode(m);
    setOverrides(new Map());
  };

  const Chevron = ({ expanded }) => (
    <span
      className="inline-block ml-2 align-middle"
      style={{
        fontSize: "9px",
        color: expanded ? "#1F4F4A" : "#A8A199",
        transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
        transition: "transform 0.15s ease, color 0.15s ease",
        lineHeight: 1,
      }}
    >
      ▾
    </span>
  );

  const titleSize = (depth) => {
    if (depth === 0) return { fontSize: "17px", fontWeight: 600 };
    if (depth === 1) return { fontSize: "15.5px", fontWeight: 500 };
    return { fontSize: "14.5px", fontWeight: 500 };
  };

  const fontStack = "'Fraunces', Georgia, 'Times New Roman', serif";
  const bodyStack = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";

  const Node = ({ node, path, depth, index }) => {
    const state = stateFor(path, depth);
    const hasChildren = node.subsections && node.subsections.length > 0;
    const isLeaf = !!node.content;
    const expanded = state === 1;

    return (
      <div className={depth > 0 ? "mt-3" : "mt-5 first:mt-0"}>
        <h3
          onClick={(e) => toggleNode(path, depth, e)}
          style={{
            fontFamily: fontStack,
            ...titleSize(depth),
            lineHeight: 1.35,
            letterSpacing: "-0.005em",
            cursor: "pointer",
          }}
          className="hover:text-teal-900 transition-colors"
        >
          {depth === 0 && (
            <span
              className="text-stone-400 mr-2 tabular-nums"
              style={{ fontSize: "13px", fontWeight: 400 }}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
          )}
          {node.title}
          <Chevron expanded={expanded} />
        </h3>

        {expanded && hasChildren && (
          <div
            className="mt-3 ml-2 pl-4"
            style={{ borderLeft: "1px solid #E5DFD5" }}
          >
            {node.subsections.map((sub, i) => (
              <Node
                key={i}
                node={sub}
                path={[...path, i]}
                depth={depth + 1}
                index={i}
              />
            ))}
          </div>
        )}

        {expanded && isLeaf && (
          <div
            className="mt-3 pl-3 text-stone-800 whitespace-pre-wrap"
            style={{
              fontSize: "14px",
              lineHeight: 1.7,
              fontFamily: bodyStack,
              borderLeft: "2px solid #E5DFD5",
            }}
          >
            {node.content}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        fontFamily: bodyStack,
        background: "#FAF7F2",
        minHeight: "100vh",
        color: "#1A1A1A",
      }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
      />

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex justify-between items-baseline mb-6 pb-3 border-b border-stone-300">
          <div>
            <h1
              style={{
                fontFamily: fontStack,
                fontWeight: 700,
                fontSize: "26px",
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              Tier Reader
            </h1>
            <p
              className="text-[10px] text-stone-500 mt-1 uppercase"
              style={{ letterSpacing: "0.12em" }}
            >
              progressive disclosure · recursive
            </p>
          </div>
          {tree && (
            <button
              onClick={reset}
              className="text-sm text-stone-600 hover:text-stone-900 underline underline-offset-4"
            >
              new text
            </button>
          )}
        </div>

        {!tree && (
          <div>
            <p className="text-stone-700 mb-5 leading-relaxed text-sm">
              Paste a Wikipedia article — or any dense text. Decomposed into a tree where titles are info-dense one-liners and leaves preserve the original text verbatim.
            </p>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full h-72 p-4 border border-stone-300 bg-white rounded text-sm leading-relaxed focus:outline-none focus:border-teal-800 focus:ring-1 focus:ring-teal-800"
              placeholder="Paste text here..."
              style={{ fontFamily: bodyStack }}
            />
            <div className="flex justify-between items-center mt-4 gap-3 flex-wrap">
              <span className="text-xs text-stone-500 tabular-nums">
                {input.length.toLocaleString()} chars
              </span>
              <div className="flex items-center gap-3">
                <label
                  className="text-[10px] text-stone-500 uppercase"
                  style={{ letterSpacing: "0.12em" }}
                >
                  model
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-stone-300 rounded bg-white focus:outline-none focus:border-teal-800 focus:ring-1 focus:ring-teal-800 cursor-pointer"
                  style={{
                    fontFamily: bodyStack,
                    color: "#1A1A1A",
                    appearance: "none",
                    backgroundImage:
                      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='%231F4F4A' d='M0 0l5 6 5-6z'/></svg>\")",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 10px center",
                    paddingRight: "28px",
                  }}
                >
                  {Object.entries(MODELS).map(([key, m]) => (
                    <option key={key} value={key}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={decompose}
                  disabled={loading || !input.trim()}
                  className="px-6 py-2 text-sm rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: "#1F4F4A",
                    color: "#FAF7F2",
                    letterSpacing: "0.03em",
                  }}
                >
                  {loading ? "Decomposing..." : "Decompose"}
                </button>
              </div>
            </div>
            {error && (
              <p className="text-red-800 text-sm mt-4 p-3 bg-red-50 border border-red-200 rounded">
                {error}
              </p>
            )}
          </div>
        )}

        {tree && (
          <div>
            <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
              <div
                className="flex gap-0.5 p-1 rounded"
                style={{ background: "#EDE5D6" }}
              >
                {[
                  { key: "discovery", label: "Discovery" },
                  { key: "overview", label: "Overview" },
                  { key: "full", label: "Full" },
                ].map((mode) => (
                  <button
                    key={mode.key}
                    onClick={() => setMode(mode.key)}
                    className="px-3.5 py-1 text-xs rounded transition-all"
                    style={{
                      background:
                        viewMode === mode.key ? "#FAF7F2" : "transparent",
                      fontWeight: viewMode === mode.key ? 500 : 400,
                      color: viewMode === mode.key ? "#1A1A1A" : "#6B6357",
                      boxShadow:
                        viewMode === mode.key
                          ? "0 1px 2px rgba(0,0,0,0.05)"
                          : "none",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 text-xs text-stone-500 tabular-nums">
                <span
                  className="uppercase"
                  style={{ letterSpacing: "0.12em", fontSize: "10px" }}
                >
                  {MODELS[model].label}
                </span>
                <span>·</span>
                <span>{tree.subsections.length} top-level</span>
              </div>
            </div>

            <div>
              {tree.subsections.map((sub, i) => (
                <Node
                  key={i}
                  node={sub}
                  path={[i]}
                  depth={0}
                  index={i}
                />
              ))}
            </div>

            <div className="mt-10 pt-4 border-t border-stone-300 text-[11px] text-stone-500 leading-relaxed">
              Click any title to toggle · Top buttons set view mode globally
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
