import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import {
  FiUploadCloud, FiDownload, FiPlus, FiTrash2, FiAlertCircle,
} from 'react-icons/fi';
import {
  getCompanies,
  listIncomes,
  uploadIncomeReport,
  createIncome,
  API_BASE_URL,
} from '../services/api';

export default function Income() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [extraction, setExtraction] = useState(null);
  const [companyId, setCompanyId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([getCompanies(), listIncomes()])
      .then(([comps, incs]) => {
        setCompanies(comps);
        setIncomes(incs);
      })
      .catch((err) => console.error(err));
  }, []);

  const onDrop = async (files) => {
    if (!files.length) return;
    setBusy(true);
    setError(null);
    try {
      const result = await uploadIncomeReport(files[0]);
      setExtraction(result);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setBusy(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg','.jpeg','.png'], 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  });

  const handleSave = async () => {
    if (!companyId) return setError('Select a company first');
    if (!extraction) return setError('No extraction data to save');

    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...extraction,
        company_id: companyId,
      };
      await createIncome(payload);
      setExtraction(null);
      setCompanyId('');
      const fresh = await listIncomes();
      setIncomes(fresh);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setBusy(false);
    }
  };

  const updateLine = (idx, field, value) => {
    setExtraction((prev) => {
      const copy = { ...prev };
      copy.lines = [...copy.lines];
      copy.lines[idx] = { ...copy.lines[idx], [field]: value };
      return copy;
    });
  };

  const addLine = () => {
    setExtraction((prev) => ({
      ...prev,
      lines: [...(prev.lines || []), {
        branch: '', invoice_no: '', machine_serial: '',
        machine_runs: 0, rate_rm: 0, amount_rm: 0,
      }],
    }));
  };

  const deleteLine = (idx) => {
    setExtraction((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== idx),
    }));
  };

  return (
    <div>
      <div className="page-header mb-4">
        <h1 className="page-title">Income / Revenue Sharing</h1>
        <p className="page-subtitle">
          Upload a Revenue Sharing Report → get a generated invoice
        </p>
      </div>

      {error && (
        <div className="pro-card mb-3" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="pro-card-body d-flex align-items-center gap-2" style={{ color: 'var(--danger)' }}>
            <FiAlertCircle /> {error}
          </div>
        </div>
      )}

      {/* Upload zone */}
      {!extraction && (
        <div className="pro-card mb-4">
          <div className="pro-card-body">
            <div
              {...getRootProps()}
              className={`upload-zone ${isDragActive ? 'active' : ''}`}
            >
              <input {...getInputProps()} />
              <FiUploadCloud className="upload-icon" />
              <h5>Drag a Revenue Sharing Report here or click to browse</h5>
              <p style={{ color: 'var(--neutral-500)' }}>
                PDF, PNG, or JPG — extraction is automatic
              </p>
            </div>
            {busy && <div className="mt-3">Extracting...</div>}
          </div>
        </div>
      )}

      {/* Extraction review */}
      {extraction && (
        <div className="pro-card mb-4">
          <div className="pro-card-header">
            <span>Review Extracted Income</span>
          </div>
          <div className="pro-card-body">
            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <label className="form-label-sm">Company *</label>
                <select
                  className="form-select"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                >
                  <option value="">— Select —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label-sm">Customer</label>
                <input
                  className="form-control"
                  value={extraction.customer_name || ''}
                  onChange={(e) => setExtraction({ ...extraction, customer_name: e.target.value })}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label-sm">Period (YYYY-MM)</label>
                <input
                  className="form-control"
                  value={extraction.period || ''}
                  onChange={(e) => setExtraction({ ...extraction, period: e.target.value })}
                />
              </div>
            </div>

            <table className="pro-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Branch</th>
                  <th>Invoice No</th>
                  <th>Machine Runs</th>
                  <th>Rate (RM)</th>
                  <th>Amount (RM)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(extraction.lines || []).map((line, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>
                      <input className="form-control" value={line.branch || ''}
                        onChange={(e) => updateLine(idx, 'branch', e.target.value)} />
                    </td>
                    <td>
                      <input className="form-control" value={line.invoice_no || ''}
                        onChange={(e) => updateLine(idx, 'invoice_no', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" className="form-control" value={line.machine_runs || 0}
                        onChange={(e) => updateLine(idx, 'machine_runs', parseInt(e.target.value) || 0)} />
                    </td>
                    <td>
                      <input type="number" step="0.01" className="form-control" value={line.rate_rm || 0}
                        onChange={(e) => updateLine(idx, 'rate_rm', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td>
                      <input type="number" step="0.01" className="form-control" value={line.amount_rm || 0}
                        onChange={(e) => updateLine(idx, 'amount_rm', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => deleteLine(idx)}>
                        <FiTrash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="d-flex justify-content-between mt-3">
              <button className="btn btn-outline-primary" onClick={addLine}>
                <FiPlus size={14} /> Add Line
              </button>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary" onClick={() => setExtraction(null)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={busy}>
                  Save & Create Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Existing incomes */}
      <div className="pro-card">
        <div className="pro-card-header">
          <span>Invoices ({incomes.length})</span>
        </div>
        <table className="pro-table">
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Company</th>
              <th>Customer</th>
              <th>Period</th>
              <th style={{ textAlign: 'right' }}>Total RM</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {incomes.map((inc) => (
              <tr key={inc.id}>
                <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{inc.invoice_number}</td>
                <td>{inc.company_name}</td>
                <td>{inc.customer_name}</td>
                <td>{inc.period || '—'}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                  RM {(inc.total_rm || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td><span className={`status-badge status-${inc.status}`}>{inc.status}</span></td>
                <td>
                  <button className="btn btn-sm btn-outline-primary"
                    onClick={() => window.open(`${API_BASE_URL}/api/incomes/${inc.id}/export/word`, '_blank')}>
                    <FiDownload size={14} /> Invoice
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}