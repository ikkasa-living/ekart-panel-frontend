import React from "react";
import "./StatusTabs.css";

export default function StatusTabs({ selectedStatus, setSelectedStatus, statusCounts = {} }) {
  const statusConfig = [
    { key: "All", label: "All Orders", color: "#2563eb" },
    { key: "New", label: "New", color: "#059669" },
    { key: "RETURN_REQUESTED", label: "Return Requested", color: "#dc2626" },
  ];

  return (
    <div className="status-tabs">
      {statusConfig.map((status) => (
        <button
          key={status.key}
          className={`status-tab ${selectedStatus === status.key ? "active" : ""}`}
          onClick={() => setSelectedStatus(status.key)}
          style={{
            borderBottom: selectedStatus === status.key ? `3px solid ${status.color}` : "none",
            color: selectedStatus === status.key ? status.color : "#666",
          }}
        >
          <span className="status-label">{status.label}</span>
          <span className="status-count">({statusCounts[status.key] || 0})</span>
        </button>
      ))}
    </div>
  );
}
