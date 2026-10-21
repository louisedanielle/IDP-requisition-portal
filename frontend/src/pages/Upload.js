import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { FiUploadCloud, FiFile, FiCheck, FiX, FiLoader, FiArrowRight, FiTrash2 } from 'react-icons/fi';
import { uploadDocument, getDocumentStatus } from '../services/api';

function Upload() {
  const [files, setFiles] = useState([]);
  const navigate = useNavigate();

  const onDrop = useCallback(async (acceptedFiles) => {
    for (const file of acceptedFiles) {
      const fileId = `${Date.now()}-${Math.random()}`;

      setFiles((prev) => [
        ...prev,
        {
          id: fileId,
          name: file.name,
          size: file.size,
          status: 'uploading',
          documentId: null,
        },
      ]);

      try {
        const result = await uploadDocument(file);

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, status: 'processing', documentId: result.document_id }
              : f
          )
        );

        pollStatus(result.document_id, fileId);
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, status: 'failed', error: err.message }
              : f
          )
        );
      }
    }
  }, []);

  const pollStatus = async (documentId, fileId) => {
    const check = async () => {
      try {
        const status = await getDocumentStatus(documentId);

        if (status.status === 'completed') {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId ? { ...f, status: 'completed' } : f
            )
          );
        } else if (status.status === 'failed') {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? { ...f, status: 'failed', error: status.error_message }
                : f
            )
          );
        } else {
          setTimeout(check, 2000);
        }
      } catch (err) {
        console.error(err);
      }
    };
    check();
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.tiff', '.bmp', '.webp'],
      'application/pdf': ['.pdf'],
    },
    maxSize: 20 * 1024 * 1024,
    multiple: true,
  });

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <FiLoader className="spin" size={18} style={{ color: 'var(--primary)' }} />;
      case 'completed':
        return <FiCheck size={18} style={{ color: 'var(--success)' }} />;
      case 'failed':
        return <FiX size={18} style={{ color: 'var(--danger)' }} />;
      default:
        return <FiFile size={18} />;
    }
  };

  const getStatusText = (status) => {
    const map = {
      uploading: 'Uploading...',
      processing: 'Extracting with AI...',
      completed: 'Ready for review',
      failed: 'Processing failed',
    };
    return map[status] || status;
  };

  const handleRemove = (fileId) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleClearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.status !== 'completed'));
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Upload Receipts</h1>
      </div>

      {/* Upload Zone */}
      <div className="pro-card mb-4">
        <div className="pro-card-body">
          <div
            {...getRootProps()}
            className={`upload-zone ${isDragActive ? 'active' : ''}`}
          >
            <input {...getInputProps()} />
            <FiUploadCloud className="upload-icon" />
            {isDragActive ? (
              <h5 style={{ color: 'var(--primary)', margin: 0 }}>Drop files to upload</h5>
            ) : (
              <>
                <h5 style={{ marginBottom: '0.5rem' }}>
                  Drag & drop receipts here, or click to browse
                </h5>
                <p style={{ color: 'var(--neutral-500)', marginBottom: '0.75rem' }}>
                  You can upload multiple files at once
                </p>
                <div
                  style={{
                    display: 'inline-flex',
                    gap: '0.5rem',
                    fontSize: '0.75rem',
                    color: 'var(--neutral-500)',
                    background: 'white',
                    padding: '0.375rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--neutral-200)',
                  }}
                >
                  <span>JPG</span>
                  <span>•</span>
                  <span>PNG</span>
                  <span>•</span>
                  <span>PDF</span>
                  <span>•</span>
                  <span>TIFF</span>
                  <span>•</span>
                  <span>Max 20MB</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Uploaded Files */}
      {files.length > 0 && (
        <div className="pro-card">
          <div className="pro-card-header">
            <span>Processing Queue ({files.length})</span>
            <button
              className="btn btn-sm btn-outline-primary"
              onClick={handleClearCompleted}
              disabled={!files.some((f) => f.status === 'completed')}
            >
              Clear Completed
            </button>
          </div>
          <div className="pro-card-body" style={{ padding: 0 }}>
            <table className="pro-table">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}></th>
                  <th>Filename</th>
                  <th>Size</th>
                  <th>Status</th>
                  <th style={{ width: '180px' }}></th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id}>
                    <td>{getStatusIcon(file.status)}</td>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--neutral-800)' }}>
                        {file.name}
                      </div>
                      {file.error && (
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--danger)',
                            marginTop: '2px',
                          }}
                        >
                          {file.error}
                        </div>
                      )}
                    </td>
                    <td style={{ color: 'var(--neutral-500)' }}>
                      {formatSize(file.size)}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          color:
                            file.status === 'completed'
                              ? 'var(--success)'
                              : file.status === 'failed'
                              ? 'var(--danger)'
                              : 'var(--neutral-600)',
                        }}
                      >
                        {getStatusText(file.status)}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex gap-2">
                        {file.status === 'completed' && (
                          <button
                            className="btn btn-sm btn-primary d-flex align-items-center gap-1"
                            onClick={() => navigate(`/review?doc=${file.documentId}`)}
                          >
                            Review <FiArrowRight size={14} />
                          </button>
                        )}
                        {(file.status === 'failed' || file.status === 'completed') && (
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleRemove(file.id)}
                            title="Remove from list"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default Upload;