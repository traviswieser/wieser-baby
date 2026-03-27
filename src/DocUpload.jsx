// ─── Pediatrician Document Upload ─────────────────────────────
// Lets caregivers attach photos or PDFs of doctor visit notes,
// vaccination records, growth charts, etc.
//
// Storage strategy:
//   • Files are converted to base64 and stored in Firestore
//     alongside the pediatricianNote record.
//   • We cap individual files at 900 KB (base64) to stay within
//     Firestore's 1 MB document limit. For larger files we show
//     a friendly error and suggest compressing first.
//   • Images are rendered inline; PDFs show a download link.

import { useState, useRef } from "react";

const MAX_FILE_BYTES = 900 * 1024; // 900 KB base64 cap

/** Convert a File to a base64 data-URL string */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

/** Resize an image File to max 800px wide before encoding */
async function resizeImage(file, maxWidth = 800) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale  = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name, { type: "image/jpeg" })),
        "image/jpeg",
        0.82
      );
    };
    img.src = url;
  });
}

// ─── Upload Button + Preview ──────────────────────────────────
export function DocUploadButton({ onFilesReady, theme }) {
  const inputRef = useRef(null);
  const [status, setStatus] = useState(null); // null | "loading" | "done" | "error"
  const [errMsg, setErrMsg]  = useState("");

  const handleChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setStatus("loading");
    setErrMsg("");

    try {
      const results = [];
      for (let file of files) {
        // Resize images before encoding
        if (file.type.startsWith("image/")) {
          file = await resizeImage(file);
        }
        if (file.size > MAX_FILE_BYTES) {
          setErrMsg(`"${file.name}" is too large (max ~900 KB). Please compress it first.`);
          setStatus("error");
          return;
        }
        const base64 = await fileToBase64(file);
        results.push({ name: file.name, type: file.type, size: file.size, base64 });
      }
      setStatus("done");
      onFilesReady(results);
    } catch (err) {
      setErrMsg("Could not read file: " + err.message);
      setStatus("error");
    }
    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        onChange={handleChange}
        style={{ display: "none" }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={status === "loading"}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 16px", borderRadius: 12,
          background: theme.card, border: `1px dashed ${theme.accent}`,
          color: theme.accent, fontWeight: 700, fontSize: 13,
          cursor: "pointer", opacity: status === "loading" ? 0.6 : 1,
        }}
      >
        {status === "loading" ? "⏳ Reading…" : "📎 Attach File"}
      </button>
      {status === "error" && (
        <p style={{ fontSize: 12, color: "#e57373", marginTop: 6 }}>{errMsg}</p>
      )}
    </div>
  );
}

// ─── Document Gallery ─────────────────────────────────────────
export function DocGallery({ docs, theme, onDelete }) {
  if (!docs || docs.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
      {docs.map((doc, idx) => {
        const isImage = doc.type?.startsWith("image/");
        const isPdf   = doc.type === "application/pdf";

        return (
          <div key={idx} style={{
            background: theme.bg, borderRadius: 12, border: `1px solid ${theme.border}`,
            overflow: "hidden",
          }}>
            {isImage && (
              <img
                src={doc.base64}
                alt={doc.name}
                style={{ width: "100%", maxHeight: 220, objectFit: "contain", display: "block", background: "#fff" }}
              />
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px" }}>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: theme.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {isPdf ? "📄" : isImage ? "🖼️" : "📎"} {doc.name}
                </div>
                <div style={{ fontSize: 11, color: theme.textMuted }}>
                  {doc.size ? `${(doc.size / 1024).toFixed(0)} KB` : ""}
                </div>
              </div>
              {isPdf && (
                <a
                  href={doc.base64}
                  download={doc.name}
                  style={{ fontSize: 12, color: theme.accent, fontWeight: 700, marginRight: 10, textDecoration: "none" }}
                >
                  ⬇ PDF
                </a>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(idx)}
                  style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 16, padding: 4 }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
