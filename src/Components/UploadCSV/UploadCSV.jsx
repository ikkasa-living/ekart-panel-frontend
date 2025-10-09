import React, { useState } from "react";
import { toast } from "react-toastify";
import "./UploadCSV.css";

const API_URL = import.meta.env.VITE_API_URL;

export default function UploadCSV({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    console.log("Selected file:", e.target.files[0]);
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
      "application/vnd.ms-excel"
    ];

    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(csv|xls|xlsx)$/i)) {
      toast.error("❌ Unsupported file type. Please upload CSV or Excel files.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    // Log FormData contents for debugging
    for (let [key, value] of formData.entries()) {
      console.log(`${key}:`, value);
    }

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

      // ✅ Pass updatedOrders to parent with additional context
      if (onUploaded && data.updatedOrders) {
        onUploaded(data.updatedOrders);
      }

      toast.success(
        `✅ ${data.updatedOrders?.length || 0} orders updated successfully! Orders moved to top.`
      );
      setFile(null);
      
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
      
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
      <button onClick={handleUpload} disabled={uploading || !file}>
        {uploading ? "Uploading..." : "Upload File"}
      </button>
    </div>
  );
}
