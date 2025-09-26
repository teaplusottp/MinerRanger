import React, { useEffect, useState, useMemo } from "react";
import { CSpinner } from "@coreui/react";
import { useDb } from '../../context/DbContext';
const AUTH_TOKEN_KEY = 'minerranger.authToken';
/* ======================= Helpers & Styling ======================= */

// GhÃ©p URL áº£nh (náº¿u server tráº£ filename) â†’ /static/<file>
const toStaticUrl = (u) => {
  const s = String(u || "");
  if (!s) return s;
  if (s.startsWith("http") || s.startsWith("/")) return s;
  return `http://localhost:8000/static/${s}`;
};

const splitInsight = (insight, accent = "#ff6f61") =>
  insight
    ? insight
        .split(/(?<=\.)\s+|(?<=\.)\n+/)
        .filter((line) => line.trim() !== "")
        .map((line, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: "6px",
              padding: "8px 12px",
              borderLeft: `4px solid ${accent}`,
              background: `${accent}22`,
              borderRadius: "6px",
            }}
          >
            â€¢ {line}
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

// Kiá»ƒu matrix: [ [ [from, to], value ], ... ]
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

// Kiá»ƒu unwanted stats: [{ activity_name|name|activity, count, percentage }, ...]
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

// MÃ u chá»§ Ä‘áº¡o theo group
const groupAccents = {
  basic: "#42a5f5",       // xanh lam
  process: "#ff6f61",     // Ä‘á» cam
  performance: "#7e57c2", // tÃ­m
  conformance: "#26a69a", // xanh ngá»c
  enhancement: "#ffa726", // cam vÃ ng
};

/* ======================= Generic Pieces ======================= */

const SectionTitle = ({ children, accent }) => (
  <h3
    style={{
      marginBottom: "16px",
      fontWeight: 800,
      fontSize: "1.4rem",
      background: `linear-gradient(90deg, ${accent}, ${accent}aa)`,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
    }}
  >
    {children}
  </h3>
);

const Block = ({ children }) => (
  <div
    style={{
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: "14px",
      padding: "20px",
      marginBottom: "24px",
    }}
  >
    {children}
  </div>
);

// Tháº» sá»‘: dÃ¹ng accent (nháº¡t hÆ¡n title), insight cÃ²n nháº¡t hÆ¡n ná»¯a
const MetricCards = ({ entries, accent }) => {
  if (!entries?.length) return null;
  return (
    <div style={{ display: "flex", gap: "20px", marginBottom: "22px", flexWrap: "wrap" }}>
      {entries.map(([key, value], idx) => (
        <div
          key={idx}
          style={{
            flex: "1 1 180px",
            background: `${accent}55`,
            padding: "20px",
            borderRadius: "14px",
            textAlign: "center",
            boxShadow: `0 4px 10px ${accent}44`,
            border: `1px solid ${accent}66`,
          }}
        >
          <div style={{ fontSize: "1rem", color: "#fff", opacity: 0.95 }}>{titleCase(key)}</div>
          <div style={{ fontSize: "1.9rem", fontWeight: 800, color: "#fff" }}>{value}</div>
        </div>
      ))}
    </div>
  );
};

// Bar ngang (má»—i cá»™t 1 mÃ u trÆ¡n = accent cá»§a group)
const HorizontalBars = ({ chartKey, chart, accent }) => {
  const labels = chart?.data?.[0] || [];
  const values = chart?.data?.[1] || [];
  const maxVal = values.length ? Math.max(...values) : 0;

  return (
    <div
      key={chartKey}
      style={{
        flex: "1 1 45%",
        minWidth: "320px",
        backgroundColor: "rgba(255,255,255,0.08)",
        padding: "20px",
        borderRadius: "12px",
        marginBottom: "22px",
        border: `1px solid ${accent}44`,
      }}
    >
      <h4 style={{ marginBottom: "14px", fontWeight: 700, fontSize: "1.1rem", color: accent }}>
        {titleCase(chartKey)}
      </h4>
      {labels.map((label, i) => {
        const val = values[i] || 0;
        const pct = maxVal ? (val / maxVal) * 100 : 0;
        const displayLabel = chartKey.toLowerCase().includes("variant") ? cleanVariantLabel(label) : label;
        return (
          <div key={`${label}-${i}`} style={{ marginBottom: "12px" }}>
            <div style={{ marginBottom: "6px", fontSize: "0.9rem", color: "#eee" }}>{displayLabel}</div>
            <div
              style={{
                background: "rgba(255,255,255,0.12)",
                borderRadius: "8px",
                height: "28px",
                border: `1px solid ${accent}33`,
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: accent,
                  borderRadius: "8px",
                  color: "#fff",
                  fontWeight: 700,
                  paddingLeft: "8px",
                  display: "flex",
                  alignItems: "center",
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

/* ======================= Special Renderers ======================= */

// Báº£ng ma tráº­n (dÃ¹ng accent cá»§a group cho viá»n/Ä‘áº§u báº£ng/Ã´ cÃ³ dá»¯ liá»‡u)
const EdgeMatrix = ({ title, edges, accent }) => {
  const nodes = useMemo(() => Array.from(new Set(edges.flatMap(([pair]) => pair))), [edges]);
  const matrixData = useMemo(
    () => nodes.map((row) => nodes.map((col) => edges.find(([[src, tgt]]) => src === row && tgt === col)?.[1] || "")),
    [edges, nodes]
  );

  return (
    <div style={{ overflowX: "auto", marginTop: "16px" }}>
      <h4 style={{ marginBottom: "12px", fontWeight: 700, fontSize: "1.1rem", color: accent }}>
        {titleCase(title)}
      </h4>
      <table style={{ borderCollapse: "collapse", background: "rgba(255,255,255,0.06)", borderRadius: "10px" }}>
        <thead>
          <tr>
            <th style={{ border: `2px solid ${accent}`, padding: "6px 10px", background: `${accent}33` }}></th>
            {nodes.map((n, i) => (
              <th key={i} style={{ border: `2px solid ${accent}`, padding: "6px 10px", background: `${accent}33` }}>
                {n}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {nodes.map((row, i) => (
            <tr key={i}>
              <th style={{ border: `2px solid ${accent}`, padding: "6px 10px", background: `${accent}33` }}>{row}</th>
              {matrixData[i].map((val, j) => (
                <td
                  key={j}
                  style={{
                    border: "1px solid rgba(255,255,255,0.2)",
                    padding: "6px 10px",
                    textAlign: "center",
                    minWidth: "48px",
                    background: val ? `${accent}22` : "transparent",
                    color: "#fff",
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

// Bar dá»c â€œunwantedâ€ (giá»¯ Ä‘Ãºng 2 mÃ u cá»‘ Ä‘á»‹nh cho 2 loáº¡i cá»™t, cÃ³ trá»¥c + ticks + sá»‘)
const UnwantedComboChart = ({ title, rows, accent }) => {
  const actLabel = (d) => d.activity_name ?? d.activity ?? d.name ?? "";
  const rawMax = Math.max(...rows.map((d) => d.count || 0), 1);
  const maxCount = Math.ceil(rawMax / 50) * 50;

  // pháº§n trÄƒm cÃ³ thá»ƒ 0â€“1 hoáº·c 0â€“100
  const pctFraction = (p) => {
    if (p == null) return 0;
    const v = Number(p);
    if (Number.isNaN(v)) return 0;
    return Math.max(0, Math.min(1, v > 1 ? v / 100 : v));
  };

  const chartHeight = 420;
  const innerHeight = chartHeight - 100; // padding top/bottom
  const countTicks = Array.from({ length: 6 }, (_, i) => Math.round((i * maxCount) / 5));
  const pctTicks = [0, 20, 40, 60, 80, 100];

  // 2 mÃ u cá»‘ Ä‘á»‹nh toÃ n dashboard
  const COUNT_COLOR = "#42a5f5";
  const PCT_COLOR = "#ef5350";

  return (
    <div style={{ marginTop: "24px" }}>
      <h4 style={{ marginBottom: "12px", fontWeight: 700, fontSize: "1.1rem", color: accent }}>
        {titleCase(title)}
      </h4>

      <div
        style={{
          position: "relative",
          width: "100%",
          height: chartHeight,
          background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.18))",
          borderRadius: "14px",
          padding: "40px 60px 60px 60px",
          border: `1px solid ${accent}55`,
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
          {pctTicks.map((_, i) => {
            const y = (i / 5) * innerHeight;
            return (
              <div
                key={`grid-${i}`}
                style={{
                  position: "absolute",
                  bottom: `${y}px`,
                  left: 0,
                  right: 0,
                  borderTop: `1px dashed ${accent}33`,
                }}
              />
            );
          })}
        </div>

        {/* Trá»¥c Count (trÃ¡i) */}
        <div
          style={{
            position: "absolute",
            left: "10px",
            top: "40px",
            bottom: "60px",
            width: "44px",
            display: "flex",
            flexDirection: "column-reverse",
            justifyContent: "space-between",
            color: COUNT_COLOR,
            fontSize: "12px",
            fontWeight: 700,
            textAlign: "right",
          }}
        >
          {countTicks.map((t, i) => (
            <div key={`l-${i}`}>{t}</div>
          ))}
        </div>

        {/* Trá»¥c Percentage (pháº£i) */}
        <div
          style={{
            position: "absolute",
            right: "10px",
            top: "40px",
            bottom: "60px",
            width: "44px",
            display: "flex",
            flexDirection: "column-reverse",
            justifyContent: "space-between",
            color: PCT_COLOR,
            fontSize: "12px",
            fontWeight: 700,
            textAlign: "left",
          }}
        >
          {pctTicks.map((t, i) => (
            <div key={`r-${i}`}>{t}%</div>
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
            const pf = pctFraction(d.percentage);
            const pctH = pf * innerHeight;

            return (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ display: "flex", gap: "14px", alignItems: "flex-end" }}>
                  {/* Count bar */}
                  <div style={{ position: "relative" }}>
                    <div
                      style={{
                        width: "28px",
                        height: `${countH}px`,
                        background: COUNT_COLOR,
                        borderRadius: "6px 6px 0 0",
                        border: `1px solid ${COUNT_COLOR}bb`,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: `${countH + 4}px`,
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: "11px",
                        color: "#fff",
                        textShadow: "0 1px 2px rgba(0,0,0,0.4)",
                        fontWeight: 700,
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
                        background: PCT_COLOR,
                        borderRadius: "6px 6px 0 0",
                        border: `1px solid ${PCT_COLOR}bb`,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: `${pctH + 4}px`,
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: "11px",
                        color: "#fff",
                        textShadow: "0 1px 2px rgba(0,0,0,0.4)",
                        fontWeight: 700,
                      }}
                    >
                      {(pf * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "0.86rem",
                    maxWidth: "150px",
                    whiteSpace: "normal",
                    color: "#eee",
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

/* ======================= Main Component ======================= */

function GraphView() {
  const [report, setReport] = useState(null);
 const { selectedDb } = useDb()

  useEffect(() => {
    if (!selectedDb) {
      setReport(null)
      return
    }

    const token = window.localStorage.getItem(AUTH_TOKEN_KEY)
    if (!token) {
      setReport(null)
      return
    }

    setReport(null)

    fetch(http://localhost:8000/graph?db=, {
      headers: {
        Authorization: Bearer ,
      },
    })
      .then((res) => res.json())
      .then((data) => setReport(data))
      .catch((err) => console.error('Error fetching report:', err))
  }, [selectedDb])           
  
  if (!selectedDb) {
    return <div style={{ padding: 20 }}>âš ï¸ HÃ£y chá»n má»™t database Ä‘á»ƒ xem bÃ¡o cÃ¡o</div>
  }

  if (!report) {
    return (
      <div
        style={{
          minHeight: "50vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1e1e2f, #121212)",
        }}
      >
        <CSpinner color="primary" />
      </div>
    );
  }

  /* ===== Group 1: Basic Statistics ===== */
  const renderBasicStatistics = () => {
    const stats = report.basic_statistics || {};
    if (!stats || typeof stats !== "object") return null;

    const cards = Object.entries(stats).filter(([, v]) => typeof v === "number");
    const chartEntries = Object.entries(stats).filter(([, v]) => v && typeof v === "object" && Array.isArray(v.data));

    return (
      <Block>
        <SectionTitle accent={groupAccents.basic}>{titleCase("Basic Statistics")}</SectionTitle>

        {cards.length > 0 && <MetricCards entries={cards} accent={groupAccents.basic} />}

        {chartEntries.length > 0 && (
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            {chartEntries.map(([k, v]) => (
              <HorizontalBars key={k} chartKey={k} chart={v} accent={groupAccents.basic} />
            ))}
          </div>
        )}

        {stats.insights && (
          <div
            style={{
              marginTop: "10px",
              borderRadius: "12px",
              background: `${groupAccents.basic}11`,
              padding: "14px",
              border: `1px solid ${groupAccents.basic}55`,
              color: "rgba(255,255,255,0.95)",
            }}
          >
            {splitInsight(stats.insights, groupAccents.basic)}
          </div>
        )}
      </Block>
    );
  };

  /* ===== Group 2: Process Discovery ===== */
  const renderProcessDiscovery = () => {
    const pd = report.process_discovery;
    if (!pd || typeof pd !== "object") return null;

    // card sá»‘
    const cards = Object.entries(pd).filter(([k, v]) => k !== "insights" && typeof v === "number");

    // áº£nh (náº¿u cÃ³ cÃ¡c field cÃ³ img_url)
    const images = Object.entries(pd)
      .filter(([, v]) => v && typeof v === "object" && "img_url" in v)
      .map(([k, v]) => ({ key: k, url: toStaticUrl(v.img_url) }));

    return (
      <Block>
        <SectionTitle accent={groupAccents.process}>{titleCase("Process Discovery")}</SectionTitle>

        {cards.length > 0 && <MetricCards entries={cards} accent={groupAccents.process} />}

        {images.length > 0 && (
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "14px" }}>
            {images.map((img, idx) => (
              <div
                key={idx}
                style={{
                  flex: "1 1 380px",
                  textAlign: "center",
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: "12px",
                  padding: "12px",
                  border: `1px solid ${groupAccents.process}44`,
                }}
              >
                <h4 style={{ marginBottom: "10px", color: groupAccents.process, fontWeight: 700 }}>
                  {titleCase(img.key)}
                </h4>
                <img
                  src={img.url}
                  alt={img.key}
                  style={{ maxWidth: "100%", maxHeight: "360px", objectFit: "contain", borderRadius: "8px" }}
                />
              </div>
            ))}
          </div>
        )}

        {/* BPMN Model tá»« field bpmn_model (KHÃ”NG hardcode) */}
        {pd.bpmn_model && (
          <div
            style={{
              textAlign: "center",
              background: "rgba(255,255,255,0.06)",
              borderRadius: "12px",
              padding: "12px",
              border: `1px solid ${groupAccents.process}44`,
              marginBottom: "16px",
            }}
          >
            <h4 style={{ marginBottom: "10px", color: groupAccents.process, fontWeight: 700 }}>BPMN Model</h4>
            <img
              src={toStaticUrl(pd.bpmn_model)}
              alt="BPMN Model"
              style={{ maxWidth: "100%", maxHeight: "360px", objectFit: "contain", borderRadius: "8px" }}
            />
          </div>
        )}

        {pd.insights && (
          <div
            style={{
              backgroundColor: `${groupAccents.process}11`,
              padding: "15px",
              borderRadius: "12px",
              border: `1px solid ${groupAccents.process}55`,
              color: "rgba(255,255,255,0.95)",
            }}
          >
            {splitInsight(pd.insights, groupAccents.process)}
          </div>
        )}
      </Block>
    );
  };

  /* ===== Group 3: Performance Analysis ===== */
  const renderPerformanceAnalysis = () => {
    const pa = report.performance_analysis;
    if (!pa || typeof pa !== "object") return null;

    const cards = Object.entries(pa).filter(
      ([k, v]) => k !== "insights" && !(v && typeof v === "object") && typeof v !== "undefined"
    );

    // KHÃ”I PHá»¤C 2 áº¢NH (dotted_chart.png, throughput_time_density.png) â€” khÃ´ng hardcode tÃªn
    const images = Object.entries(pa)
      .filter(([, v]) => v && typeof v === "object" && "img_url" in v)
      .map(([k, v]) => ({ key: k, url: toStaticUrl(v.img_url) }));

    // Báº£ng ma tráº­n tá»« object .data Ä‘áº§u tiÃªn khÃ´ng cÃ³ img_url
    const graphJsonEntry = Object.entries(pa).find(
      ([, v]) => v && typeof v === "object" && v.data && typeof v.data === "object" && !("img_url" in v)
    );
    const graphJson = graphJsonEntry ? { key: graphJsonEntry[0], ...graphJsonEntry[1] } : null;

    return (
      <Block>
        <SectionTitle accent={groupAccents.performance}>{titleCase("Performance Analysis")}</SectionTitle>

        {cards.length > 0 && <MetricCards entries={cards} accent={groupAccents.performance} />}

        {images.length > 0 && (
          <div style={{ display: "flex", gap: "20px", marginBottom: "18px", flexWrap: "wrap" }}>
            {images.map((chart, idx) => (
              <div
                key={idx}
                style={{
                  flex: "1 1 400px",
                  textAlign: "center",
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: "12px",
                  padding: "12px",
                  border: `1px solid ${groupAccents.performance}44`,
                }}
              >
                <h4 style={{ marginBottom: "10px", color: groupAccents.performance, fontWeight: 700 }}>
                  {titleCase(chart.key)}
                </h4>
                <img
                  src={chart.url}
                  alt={chart.key}
                  style={{ maxWidth: "100%", maxHeight: "320px", objectFit: "contain", borderRadius: "8px" }}
                />
              </div>
            ))}
          </div>
        )}

        {graphJson && graphJson.data && (
          <EdgeMatrix
            title={graphJson.key}
            accent={groupAccents.performance}
            edges={Object.entries(graphJson.data)
              .map(([edgeStr, val]) => {
                const [src, tgt] = parseEdgeTuple(edgeStr);
                if (!src || !tgt) return null;
                if (Array.isArray(val) && val.length === 2) {
                  return [[src, tgt], `Mean: ${Number(val[0]).toFixed(2)} | Std: ${Number(val[1]).toFixed(2)}`];
                }
                return [[src, tgt], String(val)];
              })
              .filter(Boolean)}
          />
        )}

        {pa.insights && (
          <div
            style={{
              marginTop: "14px",
              background: `${groupAccents.performance}11`,
              padding: "14px",
              borderRadius: "12px",
              border: `1px solid ${groupAccents.performance}55`,
              color: "rgba(255,255,255,0.95)",
            }}
          >
            {splitInsight(pa.insights, groupAccents.performance)}
          </div>
        )}
      </Block>
    );
  };

  /* ===== Group 4: Conformance Checking ===== */
  const renderConformanceChecking = () => {
    const cc = report.conformance_checking;
    if (!cc || typeof cc !== "object") return null;

    const { insights, ...rest } = cc;

    const cards = Object.entries(rest).filter(([, v]) => typeof v === "number");

    let matrixBlock = null;
    let unwantedBlock = null;

    Object.entries(rest).forEach(([k, v]) => {
      if (v && Array.isArray(v.data)) {
        const data = v.data;
        if (!matrixBlock && isEdgeMatrixArray(data)) {
          matrixBlock = <EdgeMatrix key={`mx-${k}`} title={k} edges={data} accent={groupAccents.conformance} />;
        } else if (!unwantedBlock && isUnwantedStatArray(data)) {
          unwantedBlock = (
            <UnwantedComboChart key={`uw-${k}`} title={k} rows={data} accent={groupAccents.conformance} />
          );
        }
      }
    });

    return (
      <Block>
        <SectionTitle accent={groupAccents.conformance}>{titleCase("Conformance Checking")}</SectionTitle>

        {cards.length > 0 && <MetricCards entries={cards} accent={groupAccents.conformance} />}

        {matrixBlock}
        {unwantedBlock}

        {insights && (
          <div
            style={{
              background: `${groupAccents.conformance}11`,
              padding: "14px",
              borderRadius: "12px",
              marginTop: "16px",
              border: `1px solid ${groupAccents.conformance}55`,
              color: "rgba(255,255,255,0.95)",
            }}
          >
            {splitInsight(insights, groupAccents.conformance)}
          </div>
        )}
      </Block>
    );
  };

  /* ===== Group 5: Enhancement ===== */
  const renderEnhancement = () => {
    const en = report.enhancement;
    if (!en || typeof en !== "object") return null;

    return (
      <Block>
        <SectionTitle accent={groupAccents.enhancement}>{titleCase("Enhancement")}</SectionTitle>
        {en.insights && (
          <div
            style={{
              background: `${groupAccents.enhancement}11`,
              padding: "14px",
              borderRadius: "12px",
              border: `1px solid ${groupAccents.enhancement}55`,
              color: "rgba(255,255,255,0.95)",
            }}
          >
            {splitInsight(en.insights, groupAccents.enhancement)}
          </div>
        )}
      </Block>
    );
  };

  /* ===== Main render ===== */
  return (
    <div
      style={{
        padding: "30px",
        color: "#fff",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
        background: "linear-gradient(135deg, #1e1e2f, #121212)",
        minHeight: "100vh",
      }}
    >
      {report.report_title && (
        <h2
          style={{
            fontSize: "2.2rem",
            fontWeight: 900,
            marginBottom: "20px",
            background: "linear-gradient(90deg, #F7666F, #406AFF)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {titleCase(report.report_title)}
        </h2>
      )}

      {report.description && (
        <Block>
          {String(report.description)
            .split("\n")
            .filter((line) => line.trim() !== "")
            .map((line, idx) => (
              <p key={idx} style={{ marginBottom: "10px", color: "#eee", lineHeight: 1.7 }}>
                {line}
              </p>
            ))}
        </Block>
      )}

      {report.dataset_overview?.date_range && (
        <Block>
          <p style={{ marginBottom: "6px", color: "#90caf9" }}>
            <strong>Start:</strong> {report.dataset_overview.date_range.start_time}
          </p>
          <p style={{ marginBottom: "0", color: "#ffcc80" }}>
            <strong>End:</strong> {report.dataset_overview.date_range.end_time}
          </p>
        </Block>
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
