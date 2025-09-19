import React, { useEffect, useState } from "react";
import { CSpinner } from "@coreui/react";
import ForceGraph2D from "react-force-graph-2d";

function GraphView() {
  const [report, setReport] = useState(null);

  useEffect(() => {
    fetch("http://localhost:8000/graph")
      .then((res) => res.json())
      .then((data) => setReport(data))
      .catch((err) => console.error("Error fetching report:", err));
  }, []);

  if (!report) return <CSpinner color="primary" />;

  // --- Helpers ---
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

  const cleanVariantLabel = (s) => s.replace(/[\(\)'"]/g, "").replace(/, /g, ", ");

  const titleCase = (str) =>
    str.replace(/_/g, " ").replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

  // --- Group 1: Basic Statistics + Charts ---
  const renderBasicStatistics = () => {
    const stats = report.basic_statistics || {};
    const statKeys = ["num_events", "num_cases", "num_activities", "num_variants", "average_activity_per_case"];
    const statItems = statKeys
      .filter((k) => stats[k] !== undefined)
      .map((k) => ({ label: k.replace(/_/g, " ").replace("num ", ""), value: stats[k] }));

    const chartKeys = Object.keys(stats).filter((k) => stats[k] && typeof stats[k] === "object" && stats[k].data);
    const maxValue = (arr) => (arr.length ? Math.max(...arr) : 0);

    if (!statItems.length && !chartKeys.length) return null;

    return (
      <div style={{ marginTop: "30px" }}>
        <h3 style={{ marginBottom: "15px", fontWeight: 600 }}>Basic Statistics</h3>

        {statItems.length > 0 && (
          <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", marginBottom: "25px" }}>
            {statItems.map((item, idx) => (
              <div
                key={idx}
                style={{
                  flex: "1 1 150px",
                  backgroundColor: "rgba(255,255,255,0.1)",
                  padding: "15px",
                  borderRadius: "8px",
                  textAlign: "center",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                }}
              >
                <div style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.7)" }}>{item.label}</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{item.value}</div>
              </div>
            ))}
          </div>
        )}

        {chartKeys.length > 0 && (
          <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", marginBottom: "25px" }}>
            {chartKeys.map((ck, idx) => {
              const chart = stats[ck];
              const dataLabels = chart.data[0] || [];
              const dataValues = chart.data[1] || [];
              const maxVal = maxValue(dataValues);
              const chartColor = idx === 0 ? "#4fc3f7" : "#ffb74d";

              return (
                <div
                  key={idx}
                  style={{
                    flex: "1 1 45%", // ~50% width mỗi chart, co giãn
                    minWidth: "300px",
                    backgroundColor: "rgba(255,255,255,0.1)",
                    padding: "15px",
                    borderRadius: "8px",
                    overflowY: "auto",
                  }}
                >
                  <h4 style={{ marginBottom: "10px" }}>{titleCase(ck)}</h4>
                  {dataLabels.map((label, i) => {
                    const val = dataValues[i] || 0;
                    const pct = (val / maxVal) * 100;
                    const displayLabel = ck.toLowerCase().includes("variant") ? cleanVariantLabel(label) : label;
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
                              background: chartColor,
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
            })}
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

  // --- Group 2: Process Discovery (Graph + k_variants + Insights) ---
  const renderProcessDiscovery = () => {
    const pd = report.process_discovery;
    if (!pd) return null;

    const { k_variants, dfg_freq = {}, dfg_perf = {}, insights } = pd;

    // Parse edge string kiểu Python tuple: "('A','B')" -> ["A","B"]
    const parseEdge = (edgeStr) => {
      const m = edgeStr.match(/\('(.+?)', '(.+?)'\)/);
      return m ? [m[1], m[2]] : [];
    };

    // Build nodes & links
    const nodesSet = new Set();
    Object.keys(dfg_freq).forEach((edgeStr) => {
      const [from, to] = parseEdge(edgeStr);
      if (from && to) {
        nodesSet.add(from);
        nodesSet.add(to);
      }
    });
    const nodes = Array.from(nodesSet).map((n) => ({ id: n }));
    const links = Object.entries(dfg_freq).map(([edgeStr, freq]) => {
      const [from, to] = parseEdge(edgeStr);
      if (!from || !to) return null;
      const perf = dfg_perf[edgeStr] || 0;
      return { source: from, target: to, freq, perf, label: `Freq: ${freq}\nPerf: ${perf}` };
    }).filter(Boolean);

    return (
      <div style={{ marginTop: "30px" }}>
        <h3 style={{ marginBottom: "15px", fontWeight: 600 }}>Process Discovery</h3>

        {k_variants !== undefined && (
          <div
            style={{
              flex: "1 1 150px",
              backgroundColor: "rgba(255,255,255,0.1)",
              padding: "15px",
              borderRadius: "8px",
              textAlign: "center",
              boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
              marginBottom: "20px",
            }}
          >
            <div style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.7)" }}>Variants</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{k_variants}</div>
          </div>
        )}

        {links.length > 0 && (
          <div style={{ height: "500px", border: "1px solid rgba(255,255,255,0.2)", marginBottom: "20px" }}>
          <ForceGraph2D
            width={800} 
            height={600} 
            graphData={{ nodes, links }}
            nodeRelSize={15}          // node size
            nodeLabel="id"             // hover node name
            nodeCanvasObject={(node, ctx, globalScale) => {
              const r = 10;
              ctx.fillStyle = '#87CEEB';
              ctx.beginPath();
              ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
              ctx.fill();
              ctx.fillStyle = 'white';
              ctx.font = `${12 / globalScale}px Sans-Serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(node.id, node.x, node.y);
            }}
            linkWidth={2}
            linkColor={() => '#A9A9A9'}
            linkCanvasObject={(link, ctx, globalScale) => {
              const text = `F:${link.freq} P:${link.perf}`;
              const midX = (link.source.x + link.target.x) / 2;
              const midY = (link.source.y + link.target.y) / 2;
              ctx.fillStyle = 'white';
              ctx.font = `${10 / globalScale}px Sans-Serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(text, midX, midY);
            }}
            d3AlphaDecay={1}  // tắt physics
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

  // --- Group 3: Performance Analysis ---
  const renderPerformanceAnalysis = () => {
    const pa = report.performance_analysis;
    if (!pa) return null;
  
    // Phân loại các key theo kiểu dữ liệu
    const stats = [];
    const chartsPNG = [];
    let chartJSON = null;
    let groupInsight = null;
  
    Object.entries(pa).forEach(([key, value]) => {
      if (key === "insights") {
        groupInsight = value;
      } else if (value && value.img_url) {
        chartsPNG.push({ key, ...value });
      } else if (value && value.data) {
        chartJSON = { key, ...value };
      } else {
        stats.push({ key, value });
      }
    });
  
    return (
      <div style={{ marginTop: "30px" }}>
        <h3 style={{ marginBottom: "15px", fontWeight: 600 }}>Performance Analysis</h3>
  
        {/* --- Thẻ thông số --- */}
        <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", marginBottom: "25px" }}>
          {stats.map((item, idx) => (
            <div
              key={idx}
              style={{
                flex: "1 1 150px",
                backgroundColor: "rgba(255,255,255,0.1)",
                padding: "15px",
                borderRadius: "8px",
                textAlign: "center",
                boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
              }}
            >
              <div style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.7)" }}>
                {item.key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{item.value}</div>
            </div>
          ))}
        </div>
  
        {/* --- Chart PNG --- */}
        <div style={{ display: "flex", gap: "20px", marginBottom: "25px", flexWrap: "wrap" }}>
          {chartsPNG.map((chart, idx) => (
            <div key={idx} style={{ flex: "1 1 400px", textAlign: "center" }}>
              <h4 style={{ marginBottom: "10px" }}>
                {chart.key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </h4>
              <img
                src={chart.img_url}
                alt={chart.key}
                style={{ maxWidth: "100%", maxHeight: "300px", objectFit: "contain" }}
              />
            </div>
          ))}
        </div>
  
        {/* --- Chart JSON (temporal_profile) --- */}
        {chartJSON && chartJSON.data && (
          <div style={{ height: "500px", border: "1px solid rgba(255,255,255,0.2)", marginBottom: "20px" }}>
            <ForceGraph2D
              width={800}
              height={600}
              graphData={{
                nodes: Array.from(
                  new Set(
                    Object.keys(chartJSON.data).flatMap((edgeStr) => {
                      const m = edgeStr.match(/\('(.+?)', '(.+?)'\)/);
                      return m ? [m[1], m[2]] : [];
                    })
                  )
                ).map((id) => ({ id })),
                links: Object.entries(chartJSON.data)
                  .map(([edgeStr, [mean, std]]) => {
                    const m = edgeStr.match(/\('(.+?)', '(.+?)'\)/);
                    if (!m) return null;
                    return { source: m[1], target: m[2], mean, std, label: `Mean: ${mean.toFixed(2)}, Std: ${std.toFixed(2)}` };
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
  
        {/* --- Insight chung của Group 3 --- */}
        {groupInsight && (
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
            {splitInsight(groupInsight)}
          </div>
        )}
      </div>
    );
  };
  


  // --- Main render ---
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
    </div>
  );
}

export default GraphView;
