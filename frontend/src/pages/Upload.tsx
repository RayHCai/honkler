import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloudUpload, File, Trash2, LoaderCircle } from 'lucide-react';
import Header from '../components/layout/Header';
import { documents } from '../lib/api';
import type { Document } from '../types/api';
import './Upload.css';

export default function Upload() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    documents.list().then(setDocs).catch(() => {});
  }, []);

  async function handleUpload(file: File) {
    setUploading(true);
    setError('');
    try {
      const doc = await documents.upload(file);
      if (doc.chat?.id) {
        navigate(`/conversations/${doc.chat.id}`);
      } else {
        setDocs(prev => [doc, ...prev]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  }

  async function handleDelete(id: string) {
    try {
      await documents.delete(id);
      setDocs(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <>
      <Header title="Upload" subtitle="Submit a bill to begin negotiation" />
      <div className="page-content">
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <div
          className={`upload-drop ${dragOver ? 'drag-over' : ''}`}
          onClick={() => !uploading && fileInput.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {uploading ? (
            <LoaderCircle size={28} className="upload-spinner" strokeWidth={1.5} />
          ) : (
            <CloudUpload size={28} strokeWidth={1.5} className="upload-drop-icon" />
          )}
          <div className="upload-drop-text">
            <span className="upload-drop-heading">
              {uploading ? 'Uploading & analyzing...' : 'Drop your bill here'}
            </span>
            <span className="upload-drop-sub">
              {uploading ? 'You will be redirected automatically' : 'or click to browse — PDF, PNG, JPG up to 10MB'}
            </span>
          </div>
        </div>

        {error && <div className="upload-error">{error}</div>}

        <section className="documents-section">
          <div className="section-header">
            <h2>Documents</h2>
          </div>
          {docs.length === 0 ? (
            <div className="empty-state">
              <p>No documents uploaded yet.</p>
            </div>
          ) : (
            <table className="documents-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Size</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {docs.map(doc => (
                  <tr key={doc.id}>
                    <td>
                      <span className="doc-name">
                        <File size={14} strokeWidth={1.5} />
                        {doc.fileName}
                      </span>
                    </td>
                    <td className="doc-meta">{formatFileSize(doc.fileSize)}</td>
                    <td className="doc-meta">{new Date(doc.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button className="doc-delete" onClick={() => handleDelete(doc.id)} title="Remove">
                        <Trash2 size={14} strokeWidth={1.5} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
