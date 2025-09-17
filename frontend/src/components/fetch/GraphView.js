import React, { useEffect, useState } from "react";
import { CSpinner } from "@coreui/react";

function GraphView() {
  const [report, setReport] = useState(null);

  useEffect(() => {
    fetch("http://localhost:8000/graph")
      .then((res) => res.json())
      .then((data) => setReport(data))
      .catch((err) => console.error("Error fetching report:", err));
  }, []);

  if (!report) {
    return <CSpinner color="primary" />;
  }

  const descriptionLines = report.description
    ? report.description.split("\n").filter((line) => line.trim() !== "")
    : [];

  const stats = report.basic_statistics || {};
  const statKeys = ["num_events", "num_cases", "num_activities", "num_variants", "average_activity_per_case"];
  const statItems = statKeys
    .filter((k) => stats[k] !== undefined)
    .map((k) => ({
      label: k.replace(/_/g, " ").replace("num ", ""),
      value: stats[k],
    }));

  const maxValue = (arr) => (arr.length ? Math.max(...arr) : 0);

  const chartKeys = Object.keys(stats).filter(
    (k) => stats[k] && typeof stats[k] === "object" && stats[k].data
  );

  // Tách insight thành bullet
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

  // Làm sạch text cho Variant chart
  const cleanVariantLabel = (s) =>
    s.replace(/[\(\)'"]/g, "").replace(/, /g, ", ");

  // Hàm viết hoa chữ đầu của mỗi từ
  const titleCase = (str) =>
    str.replace(/_/g, " ").replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

  return (
    <div style={{ padding: "20px", color: "#fff" }}>
      {report.report_title && (
        <h2 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "20px" }}>
          {titleCase(report.report_title)}
        </h2>
      )}

      {descriptionLines.length > 0 && (
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
          {descriptionLines.map((line, idx) => (
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

      {statItems.length > 0 && (
        <div style={{ marginTop: "30px" }}>
          <h3 style={{ marginBottom: "15px", fontWeight: 600 }}>Basic Statistics</h3>
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

          {chartKeys.length > 0 && (
            <div style={{ display: "flex", gap: "20px", marginBottom: "25px", flexWrap: "wrap" }}>
              {chartKeys.map((ck, idx) => {
                const chart = stats[ck];
                const dataLabels = chart.data[0] || [];
                const dataValues = chart.data[1] || [];
                const chartColor = idx === 0 ? "#4fc3f7" : "#ffb74d";

                return (
                  <div key={idx} style={{ flex: 1, minWidth: "300px" }}>
                    <h4 style={{ marginBottom: "10px" }}>{titleCase(ck)}</h4>
                    <div style={{ maxHeight: "300px", overflowY: "auto", paddingRight: "5px" }}>
                      {dataLabels.map((label, i) => {
                        const val = dataValues[i] || 0;
                        const pct = (val / maxValue(dataValues)) * 100;
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
                    <div
                      style={{
                        marginTop: "10px",
                        backgroundColor: "rgba(255,255,255,0.05)",
                        padding: "10px",
                        borderRadius: "6px",
                        fontStyle: "italic",
                        color: "rgba(255,255,255,0.85)",
                      }}
                    >
                      {splitInsight(chart.insight)}
                    </div>
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
      )}
    </div>
  );
}

export default GraphView;
