import React, { useEffect, useState, useMemo } from "react";
import { CSpinner } from "@coreui/react";
import ForceGraph2D from "react-force-graph-2d";

// ================== Helpers ==================
const splitInsight = (insight) =>
  insight
    ? insight
        .split(/(?<=\.)\s+/)
        .filter((line) => line.trim() !== "")
        .map((line, idx) => (
          <div key={idx} style={{ marginBottom: "4px" }}>
            • {line}
          </div>
        ))
    : null;

const titleCase = (str = "") =>
  String(str)
    .replace(/_/g, " ")
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

const cleanVariantLabel = (s = "") => s.replace(/[\(\)'"]/g, "").replace(/, /g, ", ");

const parseEdgeTuple = (edgeStr) => {
  const m = String(edgeStr).match(/\('(.+?)', '(.+?)'\)/);
  return m ? [m[1], m[2]] : [];
};

// dạng mảng matrix style:  [ [ [from, to], count ], ... ]
const isEdgeMatrixArray = (data) => {
  if (!Array.isArray(data) || data.length === 0) return false;
  const first = data[0];
  return (
    Array.isArray(first) &&
    first.length === 2 &&
    Array.isArray(first[0]) &&
    first[0].length === 2 &&
    typeof first[0][0] === "string" &&
    typeof first[0][1] === "string"
  );
};

// dạng unwanted stats: [{ activity_name, count, percentage }, ...]
const isUnwantedStatArray = (data) => {
  if (!Array.isArray(data) || data.length === 0) return false;
  const f = data[0];
  return (
    f &&
    typeof f === "object" &&
    ("activity_name" in f || "name" in f || "activity" in f) &&
    "count" in f &&
    "percentage" in f
  );
};

// ================== Small generic pieces ==================
const MetricCards = ({ entries }) => {
  if (!entries?.length) return null;
  return (
    <div style={{ display: "flex", gap: "15px", marginBottom: "20px", flexWrap: "wrap" }}>
      {entries.map(([key, value], idx) => (
        <div
          key={idx}
          style={{
            flex: "1 1 150px",
            background: "rgba(255,255,255,0.1)",
            padding: "15px",
            borderRadius: "8px",
            textAlign: "center",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
          }}
        >
          <div style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.7)" }}>
            {titleCase(key)}
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{value}</div>
        </div>
      ))}
    </div>
  );
};

const HorizontalBars = ({ chartKey, chart }) => {
  const labels = chart?.data?.[0] || [];
  const values = chart?.data?.[1] || [];
  const maxVal = values.length ? Math.max(...values) : 0;

  return (
    <div
      key={chartKey}
      style={{
        flex: "1 1 45%",
        minWidth: "320px",
        backgroundColor: "rgba(255,255,255,0.1)",
        padding: "15px",
        borderRadius: "8px",
        marginBottom: "20px",
      }}
    >
      <h4 style={{ marginBottom: "10px" }}>{titleCase(chartKey)}</h4>
      {labels.map((label, i) => {
        const val = values[i] || 0;
        const pct = maxVal ? (val / maxVal) * 100 : 0;
        const displayLabel = chartKey.toLowerCase().includes("variant") ? cleanVariantLabel(label) : label;
        return (
          <div key={`${label}-${i}`} style={{ marginBottom: "8px" }}>
            <div style={{ marginBottom: "3px", fontSize: "0.85rem" }}>{displayLabel}</div>
            <div
              style={{
                background: "rgba(255,255,255,0.1)",
                borderRadius: "4px",
                height: "30px",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: "#4fc3f7",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  paddingLeft: "8px",
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                {val}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ================== Special renderers ==================
const EdgeMatrix = ({ title, edges }) => {
  const nodes = useMemo(() => Array.from(new Set(edges.flatMap(([pair]) => pair))), [edges]);

  const matrixData = useMemo(
    () =>
      nodes.map((row) =>
        nodes.map((col) => {
          const found = edges.find(([[src, tgt]]) => src === row && tgt === col);
          return found ? found[1] : "";
        })
      ),
    [edges, nodes]
  );

  return (
    <div style={{ overflowX: "auto", marginTop: "20px" }}>
      <h4 style={{ marginBottom: "10px" }}>{titleCase(title)}</h4>
      <table style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #666", padding: "6px 8px" }}></th>
            {nodes.map((n, i) => (
              <th key={i} style={{ border: "1px solid #666", padding: "6px 8px", whiteSpace: "nowrap" }}>
                {n}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {nodes.map((row, i) => (
            <tr key={i}>
              <th style={{ border: "1px solid #666", padding: "6px 8px", whiteSpace: "nowrap" }}>{row}</th>
              {matrixData[i].map((val, j) => (
                <td
                  key={j}
                  style={{
                    border: "1px solid #666",
                    padding: "6px 8px",
                    textAlign: "center",
                    minWidth: "48px",
                  }}
                >
                  {val}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const UnwantedComboChart = ({ title, rows }) => {
  const actLabel = (d) => d.activity_name ?? d.activity ?? d.name ?? "";

  // Max count làm tròn lên bội số của 50
  const rawMax = Math.max(...rows.map((d) => d.count || 0), 1);
  const maxCount = Math.ceil(rawMax / 50) * 50;

  const maxPct = 100;
  const chartHeight = 400;
  const innerHeight = chartHeight - 100; // padding top/bottom

  const countTicks = Array.from({ length: 6 }, (_, i) =>
    Math.round((i * maxCount) / 5)
  );
  const pctTicks = Array.from({ length: 6 }, (_, i) =>
    Math.round((i * maxPct) / 5)
  );

  return (
    <div style={{ marginTop: "24px" }}>
      <h4 style={{ marginBottom: "12px" }}>{titleCase(title)}</h4>

      <div
        style={{
          position: "relative",
          width: "100%",
          height: chartHeight,
          background: "rgba(255,255,255,0.05)",
          borderRadius: "8px",
          padding: "40px 60px 60px 60px",
        }}
      >
        {/* Grid lines */}
        <div
          style={{
            position: "absolute",
            left: "60px",
            right: "60px",
            top: "40px",
            bottom: "60px",
          }}
        >
          {countTicks.map((t, i) => {
            const y = (i / 5) * innerHeight;
            return (
              <div
                key={`grid-${i}`}
                style={{
                  position: "absolute",
                  bottom: `${y}px`,
                  left: 0,
                  right: 0,
                  borderTop: "1px dashed rgba(255,255,255,0.1)",
                }}
              />
            );
          })}
        </div>

        {/* Trục Count (trái) */}
        <div
          style={{
            position: "absolute",
            left: "10px",
            top: "40px",
            bottom: "60px",
            width: "40px",
            display: "flex",
            flexDirection: "column-reverse",
            justifyContent: "space-between",
            color: "rgba(255,255,255,0.7)",
            fontSize: "12px",
          }}
        >
          {countTicks.map((t, i) => (
            <div key={`l-${i}`} style={{ textAlign: "right" }}>
              {t}
            </div>
          ))}
        </div>

        {/* Trục Percentage (phải) */}
        <div
          style={{
            position: "absolute",
            right: "10px",
            top: "40px",
            bottom: "60px",
            width: "40px",
            display: "flex",
            flexDirection: "column-reverse",
            justifyContent: "space-between",
            color: "rgba(255,255,255,0.7)",
            fontSize: "12px",
          }}
        >
          {pctTicks.map((t, i) => (
            <div key={`r-${i}`} style={{ textAlign: "left" }}>
              {t}%
            </div>
          ))}
        </div>

        {/* Bars */}
        <div
          style={{
            position: "absolute",
            left: "60px",
            right: "60px",
            top: "40px",
            bottom: "60px",
            display: "flex",
            alignItems: "flex-end",
            gap: "40px",
            justifyContent: "center",
          }}
        >
          {rows.map((d, i) => {
            const countH = (d.count / maxCount) * innerHeight;
            const pctH = ((d.percentage || 0) * 100 / maxPct) * innerHeight;

            return (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
                  {/* Count bar */}
                  <div style={{ position: "relative" }}>
                    <div
                      style={{
                        width: "28px",
                        height: `${countH}px`,
                        background: "#4fc3f7",
                        borderRadius: "4px 4px 0 0",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: `${countH + 4}px`,
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: "11px",
                        color: "white",
                      }}
                    >
                      {d.count}
                    </div>
                  </div>

                  {/* Percentage bar */}
                  <div style={{ position: "relative" }}>
                    <div
                      style={{
                        width: "28px",
                        height: `${pctH}px`,
                        background: "#ffb74d",
                        borderRadius: "4px 4px 0 0",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: `${pctH + 4}px`,
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: "11px",
                        color: "white",
                      }}
                    >
                      {((d.percentage || 0) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "0.8rem",
                    maxWidth: "140px",
                    whiteSpace: "normal",
                  }}
                >
                  {actLabel(d)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ================== Component ==================
function GraphView() {
  const [report, setReport] = useState(null);

  useEffect(() => {
    fetch("http://localhost:8000/graph")
      .then((res) => res.json())
      .then((data) => setReport(data))
      .catch((err) => console.error("Error fetching report:", err));
  }, []);

  if (!report) return <CSpinner color="primary" />;

  // ===== Group 1: Basic Statistics =====
  const renderBasicStatistics = () => {
    const stats = report.basic_statistics || {};
    if (!stats || typeof stats !== "object") return null;

    // Cards (chỉ numeric)
    const cards = Object.entries(stats).filter(([, v]) => typeof v === "number");

    // Charts (bất kỳ key có .data là dạng [labels, values])
    const chartEntries = Object.entries(stats).filter(
      ([, v]) => v && typeof v === "object" && Array.isArray(v.data)
    );

    return (
      <div style={{ marginTop: "30px" }}>
        <h3 style={{ marginBottom: "15px", fontWeight: 600 }}>{titleCase("Basic Statistics")}</h3>

        {cards.length > 0 && <MetricCards entries={cards} />}

        {chartEntries.length > 0 && (
          <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
            {chartEntries.map(([k, v]) => (
              <HorizontalBars key={k} chartKey={k} chart={v} />
            ))}
          </div>
        )}

        {stats.insights && (
          <div
            style={{
              backgroundColor: "rgba(255,255,255,0.05)",
              padding: "15px",
              borderRadius: "8px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              color: "rgba(255,255,255,0.85)",
              fontStyle: "italic",
            }}
          >
            {splitInsight(stats.insights)}
          </div>
        )}
      </div>
    );
  };

  // ===== Group 2: Process Discovery =====
  const renderProcessDiscovery = () => {
    const pd = report.process_discovery;
    if (!pd || typeof pd !== "object") return null;

    const { insights, dfg_freq = {}, dfg_perf = {} } = pd;

    // metric cards: mọi numeric field
    const cards = Object.entries(pd).filter(
      ([k, v]) => k !== "insights" && typeof v === "number"
    );

    // Graph DFG từ dfg_freq/perf
    const nodesSet = new Set();
    Object.keys(dfg_freq).forEach((edgeStr) => {
      const [from, to] = parseEdgeTuple(edgeStr);
      if (from && to) {
        nodesSet.add(from);
        nodesSet.add(to);
      }
    });
    const nodes = Array.from(nodesSet).map((id) => ({ id }));
    const links = Object.entries(dfg_freq)
      .map(([edgeStr, freq]) => {
        const [from, to] = parseEdgeTuple(edgeStr);
        if (!from || !to) return null;
        const perf = dfg_perf[edgeStr] ?? 0;
        return { source: from, target: to, freq, perf, label: `F:${freq} P:${perf}` };
      })
      .filter(Boolean);

    // Images (nếu có) — ví dụ bpmn_model
    const images = Object.entries(pd)
      .filter(([, v]) => v && typeof v === "object" && "img_url" in v)
      .map(([k, v]) => ({ key: k, url: v.img_url }));

    return (
      <div style={{ marginTop: "30px" }}>
        <h3 style={{ marginBottom: "15px", fontWeight: 600 }}>{titleCase("Process Discovery")}</h3>

        {cards.length > 0 && <MetricCards entries={cards} />}

        {images.length > 0 && (
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "20px" }}>
            {images.map((img, idx) => (
              <div key={idx} style={{ flex: "1 1 380px", textAlign: "center" }}>
                <h4 style={{ marginBottom: "10px" }}>{titleCase(img.key)}</h4>
                <img
                  src={img.url}
                  alt={img.key}
                  style={{ maxWidth: "100%", maxHeight: "360px", objectFit: "contain" }}
                />
              </div>
            ))}
          </div>
        )}

        {links.length > 0 && (
          <div
            style={{
              height: "520px",
              border: "1px solid rgba(255,255,255,0.2)",
              marginBottom: "20px",
            }}
          >
            <ForceGraph2D
              width={800}
              height={600}
              graphData={{ nodes, links }}
              nodeRelSize={15}
              nodeLabel="id"
              nodeCanvasObject={(node, ctx, globalScale) => {
                const r = 10;
                ctx.fillStyle = "#87CEEB";
                ctx.beginPath();
                ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
                ctx.fill();
                ctx.fillStyle = "white";
                ctx.font = `${12 / globalScale}px Sans-Serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(node.id, node.x, node.y);
              }}
              linkWidth={2}
              linkColor={() => "#A9A9A9"}
              linkCanvasObject={(link, ctx, globalScale) => {
                const midX = (link.source.x + link.target.x) / 2;
                const midY = (link.source.y + link.target.y) / 2;
                ctx.fillStyle = "white";
                ctx.font = `${10 / globalScale}px Sans-Serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(link.label, midX, midY);
              }}
              d3AlphaDecay={1}
            />
          </div>
        )}

        {insights && (
          <div
            style={{
              backgroundColor: "rgba(255,255,255,0.05)",
              padding: "15px",
              borderRadius: "8px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              color: "rgba(255,255,255,0.85)",
              fontStyle: "italic",
            }}
          >
            {splitInsight(insights)}
          </div>
        )}
      </div>
    );
  };

  // ===== Group 3: Performance Analysis =====
  const renderPerformanceAnalysis = () => {
    const pa = report.performance_analysis;
    if (!pa || typeof pa !== "object") return null;

    const cards = Object.entries(pa).filter(
      ([k, v]) => k !== "insights" && !(v && typeof v === "object") && typeof v !== "undefined"
    );

    const images = Object.entries(pa)
      .filter(([, v]) => v && typeof v === "object" && "img_url" in v)
      .map(([k, v]) => ({ key: k, url: v.img_url }));

    const graphJsonEntry = Object.entries(pa).find(
      ([, v]) => v && typeof v === "object" && v.data && typeof v.data === "object" && !("img_url" in v)
    );
    const graphJson = graphJsonEntry ? { key: graphJsonEntry[0], ...graphJsonEntry[1] } : null;

    return (
      <div style={{ marginTop: "30px" }}>
        <h3 style={{ marginBottom: "15px", fontWeight: 600 }}>{titleCase("Performance Analysis")}</h3>

        {cards.length > 0 && <MetricCards entries={cards} />}

        {images.length > 0 && (
          <div style={{ display: "flex", gap: "20px", marginBottom: "25px", flexWrap: "wrap" }}>
            {images.map((chart, idx) => (
              <div key={idx} style={{ flex: "1 1 400px", textAlign: "center" }}>
                <h4 style={{ marginBottom: "10px" }}>{titleCase(chart.key)}</h4>
                <img
                  src={chart.url}
                  alt={chart.key}
                  style={{ maxWidth: "100%", maxHeight: "320px", objectFit: "contain" }}
                />
              </div>
            ))}
          </div>
        )}

        {graphJson && graphJson.data && (
          <div
            style={{
              height: "520px",
              border: "1px solid rgba(255,255,255,0.2)",
              marginBottom: "20px",
            }}
          >
            <ForceGraph2D
              width={800}
              height={600}
              graphData={{
                nodes: Array.from(
                  new Set(
                    Object.keys(graphJson.data).flatMap((edgeStr) => {
                      const [a, b] = parseEdgeTuple(edgeStr);
                      return a && b ? [a, b] : [];
                    })
                  )
                ).map((id) => ({ id })),
                links: Object.entries(graphJson.data)
                  .map(([edgeStr, val]) => {
                    const [a, b] = parseEdgeTuple(edgeStr);
                    if (!a || !b) return null;
                    let label = "";
                    if (Array.isArray(val) && val.length === 2 && typeof val[0] === "number") {
                      label = `Mean: ${val[0].toFixed(2)}, Std: ${val[1].toFixed(2)}`;
                    } else if (Array.isArray(val)) {
                      label = val.join(", ");
                    } else {
                      label = String(val);
                    }
                    return { source: a, target: b, label };
                  })
                  .filter(Boolean),
              }}
              nodeRelSize={15}
              nodeLabel="id"
              nodeCanvasObject={(node, ctx, globalScale) => {
                const r = 10;
                ctx.fillStyle = "#87CEEB";
                ctx.beginPath();
                ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
                ctx.fill();
                ctx.fillStyle = "white";
                ctx.font = `${12 / globalScale}px Sans-Serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(node.id, node.x, node.y);
              }}
              linkWidth={2}
              linkColor={() => "#A9A9A9"}
              linkCanvasObject={(link, ctx, globalScale) => {
                const midX = (link.source.x + link.target.x) / 2;
                const midY = (link.source.y + link.target.y) / 2;
                ctx.fillStyle = "white";
                ctx.font = `${10 / globalScale}px Sans-Serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(link.label, midX, midY);
              }}
              d3AlphaDecay={1}
            />
          </div>
        )}

        {pa.insights && (
          <div
            style={{
              backgroundColor: "rgba(255,255,255,0.05)",
              padding: "15px",
              borderRadius: "8px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              color: "rgba(255,255,255,0.85)",
              fontStyle: "italic",
            }}
          >
            {splitInsight(pa.insights)}
          </div>
        )}
      </div>
    );
  };

  // ===== Group 4: Conformance Checking =====
  const renderConformanceChecking = () => {
    const cc = report.conformance_checking;
    if (!cc || typeof cc !== "object") return null;

    const { insights, ...rest } = cc;

    // 1) Thẻ số: tất cả numeric field
    const cards = Object.entries(rest).filter(([, v]) => typeof v === "number");

    // 2) Matrix & 3) Unwanted combo chart — nhận dạng KHÔNG hardcode key
    let matrixBlock = null;
    let unwantedBlock = null;

    Object.entries(rest).forEach(([k, v]) => {
      if (v && Array.isArray(v.data)) {
        const data = v.data;
        if (!matrixBlock && isEdgeMatrixArray(data)) {
          matrixBlock = <EdgeMatrix key={`mx-${k}`} title={k} edges={data} />;
        } else if (!unwantedBlock && isUnwantedStatArray(data)) {
          unwantedBlock = <UnwantedComboChart key={`uw-${k}`} title={k} rows={data} />;
        }
      }
    });

    return (
      <div style={{ marginTop: "30px" }}>
        <h3 style={{ marginBottom: "15px", fontWeight: 600 }}>{titleCase("Conformance Checking")}</h3>

        {cards.length > 0 && <MetricCards entries={cards} />}

        {matrixBlock}
        {unwantedBlock}

        {insights && (
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              padding: "15px",
              borderRadius: "8px",
              marginTop: "20px",
              fontStyle: "italic",
            }}
          >
            {splitInsight(insights)}
          </div>
        )}
      </div>
    );
  };

  // ===== Group 5: Enhancement =====
  const renderEnhancement = () => {
    const en = report.enhancement;
    if (!en || typeof en !== "object") return null;

    return (
      <div style={{ marginTop: "30px" }}>
        <h3 style={{ marginBottom: "15px", fontWeight: 600 }}>{titleCase("Enhancement")}</h3>
        {en.insights && (
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              padding: "15px",
              borderRadius: "8px",
              fontStyle: "italic",
            }}
          >
            {splitInsight(en.insights)}
          </div>
        )}
      </div>
    );
  };

  // ===== Main render =====
  return (
    <div style={{ padding: "20px", color: "#fff" }}>
      {report.report_title && (
        <h2 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "20px" }}>
          {titleCase(report.report_title)}
        </h2>
      )}

      {report.description && (
        <div
          style={{
            backgroundColor: "rgba(255,255,255,0.05)",
            padding: "15px",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            marginBottom: "20px",
            lineHeight: "1.6",
          }}
        >
          {report.description
            .split("\n")
            .filter((line) => line.trim() !== "")
            .map((line, idx) => (
              <p key={idx} style={{ marginBottom: "10px", color: "rgba(255,255,255,0.85)" }}>
                {line}
              </p>
            ))}
        </div>
      )}

      {report.dataset_overview?.date_range && (
        <>
          <p style={{ marginBottom: "5px" }}>
            <strong>Start:</strong> {report.dataset_overview.date_range.start_time}
          </p>
          <p style={{ marginBottom: "20px" }}>
            <strong>End:</strong> {report.dataset_overview.date_range.end_time}
          </p>
        </>
      )}

      {renderBasicStatistics()}
      {renderProcessDiscovery()}
      {renderPerformanceAnalysis()}
      {renderConformanceChecking()}
      {renderEnhancement()}
    </div>
  );
}

export default GraphView;
