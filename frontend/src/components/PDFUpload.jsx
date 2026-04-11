import React, { useState } from 'react';

export default function PDFUpload({ token, onUploadSuccess }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [error, setError] = useState('');

  async function handleUpload(file) {
    if (!file || file.type !== 'application/pdf') {
      setError('Please upload a PDF file only.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be under 10MB.');
      return;
    }

    setError('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/pdf/upload`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setUploadedFile(file.name);
      onUploadSuccess?.(file.name);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleUpload(file);
  }

  function handleFileInput(e) {
    const file = e.target.files[0];
    handleUpload(file);
  }

  async function handleClear() {
    try {
      await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/pdf/clear`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setUploadedFile(null);
      onUploadSuccess?.(null);
    } catch {
      // silent
    }
  }

  return (
    <div className="px-3 py-3 border-t border-neutral-800">
      <p className="text-xs text-neutral-500 mb-2 font-medium uppercase tracking-wider">
        📄 PDF Chat
      </p>

      {uploadedFile ? (
        // ── Uploaded state ──────────────────────────────────────
        <div className="bg-neutral-800 rounded-xl px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-green-400 text-sm">✓</span>
            <span className="text-xs text-neutral-300 truncate">{uploadedFile}</span>
          </div>
          <button
            onClick={handleClear}
            className="text-xs text-neutral-500 hover:text-red-400 transition-colors ml-2 flex-shrink-0"
          >
            Remove
          </button>
        </div>
      ) : (
        // ── Drop zone ───────────────────────────────────────────
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl px-3 py-4 cursor-pointer transition-colors ${
            dragging
              ? 'border-neutral-400 bg-neutral-700'
              : 'border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800'
          }`}
        >
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileInput}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-1">
              <div className="w-5 h-5 border-2 border-neutral-400 border-t-white rounded-full animate-spin" />
              <p className="text-xs text-neutral-400">Indexing PDF...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-2xl">📎</span>
              <p className="text-xs text-neutral-400">Drop PDF here or click to upload</p>
              <p className="text-xs text-neutral-600">Max 10MB</p>
            </div>
          )}
        </label>
      )}

      {error && (
        <p className="text-red-400 text-xs mt-2">{error}</p>
      )}
    </div>
  );
}