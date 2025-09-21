import React, { useEffect, useState } from "react";
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

const titleCase = (str) =>
  str
    .replace(/_/g, " ")
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

const cleanVariantLabel = (s) =>
  s.replace(/[\(\)'"]/g, "").replace(/, /g, ", ");

// parse Python tuple dạng "('A','B')"
const parseEdgeStr = (edgeStr) => {
  const m = edgeStr.match(/\('(.+?)', '(.+?)'\)/);
  return m ? [m[1], m[2]] : [];
};

// ================== Renderers ==================
const renderCards = (entries) => (
  <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", marginBottom: "20px" }}>
    {entries.map(([key, value], idx) => (
      <div
        key={idx}
        style={{
          flex: "1 1 150px",
          background: "rgba(255,255,255,0.1)",
          padding: "15px",
          borderRadius: "8px",
          textAlign: "center",
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

const renderBarChart = (key, chart) => {
  const labels = chart.data[0] || [];
  const values = chart.data[1] || [];
  const maxVal = Math.max(...values, 1);

  return (
    <div
      key={key}
      style={{
        flex: "1 1 45%",
        minWidth: "300px",
        backgroundColor: "rgba(255,255,255,0.1)",
        padding: "15px",
        borderRadius: "8px",
        marginBottom: "20px",
      }}
    >
      <h4 style={{ marginBottom: "10px" }}>{titleCase(key)}</h4>
      {labels.map((label, i) => {
        const val = values[i] || 0;
        const pct = (val / maxVal) * 100;
        const displayLabel = key.toLowerCase().includes("variant")
          ? cleanVariantLabel(label)
          : label;

        return (
          <div key={i} style={{ marginBottom: "8px" }}>
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

const renderMatrix = (key, edges) => {
  const nodes = Array.from(new Set(edges.flatMap(([pair]) => pair)));
  const matrixData = nodes.map((row) =>
    nodes.map((col) => {
      const found = edges.find(([[src, tgt]]) => src === row && tgt === col);
      return found ? found[1] : "";
    })
  );

  return (
    <div style={{ overflowX: "auto", marginTop: "20px" }}>
      <h4 style={{ marginBottom: "10px" }}>{titleCase(key)}</h4>
      <table style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #666", padding: "5px" }}></th>
            {nodes.map((n, i) => (
              <th key={i} style={{ border: "1px solid #666", padding: "5px" }}>
                {n}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {nodes.map((row, i) => (
            <tr key={i}>
              <th style={{ border: "1px solid #666", padding: "5px" }}>{row}</th>
              {matrixData[i].map((val, j) => (
                <td
                  key={j}
                  style={{
                    border: "1px solid #666",
                    padding: "5px",
                    textAlign: "center",
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

const renderUnwantedChart = (key, data) => (
  <div style={{ marginTop: "20px" }}>
    <h4 style={{ marginBottom: "10px" }}>{titleCase(key)}</h4>
    <div style={{ display: "flex", gap: "20px", alignItems: "flex-end" }}>
      {data.map((d, i) => (
        <div key={i} style={{ textAlign: "center" }}>
          <div style={{ display: "flex", gap: "5px", alignItems: "flex-end" }}>
            <div
              style={{
                width: "20px",
                height: `${d.count}px`,
                background: "#4fc3f7",
              }}
              title={`Count: ${d.count}`}
            ></div>
            <div
              style={{
                width: "20px",
                height: `${d.percentage * 100}px`,
                background: "#ffb74d",
              }}
              title={`Percentage: ${(d.percentage * 100).toFixed(2)}%`}
            ></div>
          </div>
          <div style={{ marginTop: "5px", fontSize: "0.8rem" }}>{d.activity_name}</div>
        </div>
      ))}
    </div>
  </div>
);

// ================== Main Component ==================
function GraphView() {
  const [report, setReport] = useState(null);

  useEffect(() => {
    fetch("http://localhost:8000/graph")
      .then((res) => res.json())
      .then((data) => setReport(data))
      .catch((err) => console.error("Error fetching report:", err));
  }, []);

  if (!report) return <CSpinner color="primary" />;

  // ================== Render Groups ==================
  const renderGroup = (groupKey, groupValue) => {
    if (!groupValue) return null;

    const entries = Object.entries(groupValue);
    let cards = [];
    let charts = [];
    let matrix = null;
    let unwantedChart = null;
    let images = [];
    let graphs = [];
    let insights = null;

    entries.forEach(([key, value]) => {
      if (key === "insights") {
        insights = value;
      } else if (typeof value === "number") {
        cards.push([key, value]);
      } else if (value?.data && Array.isArray(value.data)) {
        if (key.toLowerCase().includes("edge")) {
          matrix = renderMatrix(key, value.data);
        } else if (key.toLowerCase().includes("unwanted")) {
          unwantedChart = renderUnwantedChart(key, value.data);
        } else {
          charts.push(renderBarChart(key, value));
        }
      } else if (value?.img_url) {
        images.push({ key, url: value.img_url });
      } else if (value?.data && typeof value.data === "object") {
        // Graph JSON (temporal profile, dfg, etc.)
        const nodesSet = new Set();
        const links = Object.entries(value.data)
          .map(([edgeStr, arr]) => {
            const [from, to] = parseEdgeStr(edgeStr);
            if (!from || !to) return null;
            nodesSet.add(from);
            nodesSet.add(to);
            let label = "";
            if (Array.isArray(arr)) {
              if (arr.length === 2 && typeof arr[0] === "number") {
                label = `Mean: ${arr[0].toFixed(2)}, Std: ${arr[1].toFixed(2)}`;
              } else {
                label = arr.join(", ");
              }
            } else {
              label = arr;
            }
            return { source: from, target: to, label };
          })
          .filter(Boolean);

        const nodes = Array.from(nodesSet).map((id) => ({ id }));
        graphs.push({ key, nodes, links });
      }
    });

    return (
      <div style={{ marginTop: "30px" }}>
        <h3 style={{ marginBottom: "15px", fontWeight: 600 }}>{titleCase(groupKey)}</h3>

        {cards.length > 0 && renderCards(cards)}

        {charts.length > 0 && (
          <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>{charts}</div>
        )}

        {matrix}
        {unwantedChart}

        {images.length > 0 && (
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginTop: "20px" }}>
            {images.map((img, idx) => (
              <div key={idx} style={{ flex: "1 1 400px", textAlign: "center" }}>
                <h4 style={{ marginBottom: "10px" }}>{titleCase(img.key)}</h4>
                <img
                  src={img.url}
                  alt={img.key}
                  style={{ maxWidth: "100%", maxHeight: "300px", objectFit: "contain" }}
                />
              </div>
            ))}
          </div>
        )}

        {graphs.length > 0 &&
          graphs.map((g, idx) => (
            <div
              key={idx}
              style={{
                height: "500px",
                border: "1px solid rgba(255,255,255,0.2)",
                marginBottom: "20px",
              }}
            >
              <ForceGraph2D
                width={800}
                height={600}
                graphData={{ nodes: g.nodes, links: g.links }}
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
          ))}

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

  // ================== Main render ==================
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

      {Object.entries(report)
        .filter(([k]) =>
          !["report_title", "description", "dataset_overview"].includes(k)
        )
        .map(([k, v]) => renderGroup(k, v))}
    </div>
  );
}

export default GraphView;
