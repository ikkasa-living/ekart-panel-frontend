import React, { useState } from "react";
import { toast } from "react-toastify";
import "./UploadCSV.css";

const API_URL = import.meta.env.VITE_API_URL;

export default function UploadCSV({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("⚠ Please select a file first.");
      return;
    }
    const allowedTypes = [
      "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(csv|xls|xlsx)$/i)) {
      toast.error("❌ Unsupported file type. Please upload CSV or Excel files.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    try {
      setUploading(true);
      const res = await fetch(`${API_URL}/api/csv/upload-merge`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        toast.error(`❌ ${data.error || "Upload failed"}`);
        return;
      }
      onUploaded?.();
      toast.success(
        `✅ ${data.updatedOrders?.length || 0} orders updated or created successfully!`
      );
      setFile(null);
    } catch (error) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-csv-container">
      <label className="file-upload-label">
        Choose File
        <input
          type="file"
          accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
          onChange={handleFileChange}
          disabled={uploading}
        />
      </label>
      <span className="file-name">{file ? file.name : "No file chosen"}</span>
      <button onClick={handleUpload} disabled={uploading}>
        {uploading ? "Uploading..." : "Upload File"}
      </button>
    </div>
  );
}
