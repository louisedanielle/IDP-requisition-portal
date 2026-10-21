import React, { useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Link } from 'react-router-dom';
import {
  FiUploadCloud, FiDownload, FiPlus, FiTrash2, FiAlertCircle, FiLoader, FiEye,
} from 'react-icons/fi';
import {
  getCompanies,
  createCompany,
  listIncomes,
  uploadIncomeReport,
  createIncome,
  deleteIncome,
  API_BASE_URL,
} from '../services/api';

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export default function Income() {
  const [companies, setCompanies] = useState([]);
  const [incomes, setIncomes] = useState([]);

  // Extraction & Form state
  const [extraction, setExtraction] = useState(null);
  const [companyId, setCompanyId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [busy, setBusy] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [comps, incs] = await Promise.all([getCompanies(), listIncomes()]);
      setCompanies(comps);
      setIncomes(incs);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || err.message);
    }
  };

  // Auto-generate the preview invoice number when company changes
  useEffect(() => {
    if (!companyId) {
      setInvoiceNumber('');
      return;
    }
    const selected = companies.find((c) => c.id === companyId);
    if (!selected) return;

    const prefix = (selected.short_name || 'LSI').toUpperCase();
    // Only consider incomes that actually have an invoice_number string
    const matches = incomes.filter(
      (i) => typeof i.invoice_number === 'string' && i.invoice_number.startsWith(prefix)
    );

    let nextNum = 1;
    if (matches.length > 0) {
      const highest = matches.reduce((prev, current) =>
        prev.invoice_number > current.invoice_number ? prev : current
      );
      const digits = highest.invoice_number.match(/(\d+)$/);
      if (digits) nextNum = parseInt(digits[1], 10) + 1;
    }
    setInvoiceNumber(`${prefix}${String(nextNum).padStart(4, '0')}`);
  }, [companyId, incomes, companies]);

  const onDrop = async (files) => {
    if (!files.length) return;
    setIsExtracting(true);
    setError(null);
    try {
      const result = await uploadIncomeReport(files[0]);
      if (result.error) throw new Error(result.error);
      // Make sure lines is an array so the UI never crashes
      setExtraction({ ...result, lines: Array.isArray(result.lines) ? result.lines : [] });
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setIsExtracting(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png'], 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  });

  const handleAddCompany = async () => {
    const name = newCompanyName.trim();
    if (!name) return;
    try {
      const created = await createCompany(name, name.substring(0, 4));
      const fresh = await getCompanies();
      setCompanies(fresh);
      setCompanyId(created.id);
      setNewCompanyName('');
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const handleSave = async () => {
    if (!companyId) return setError('Please select the company this invoice belongs to.');
    if (!invoiceNumber) return setError('Invoice number is required.');
    if (!extraction) return setError('No extraction data to save.');

    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...extraction,
        company_id: companyId,
        invoice_number: invoiceNumber,
      };
      await createIncome(payload);

      // Reset form
      setExtraction(null);
      setCompanyId('');
      setInvoiceNumber('');

      // Refresh list
      const fresh = await listIncomes();
      setIncomes(fresh);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id, invNumber) => {
    if (!window.confirm(`Delete ${invNumber}? This cannot be undone.`)) return;
    try {
      await deleteIncome(id);
      const fresh = await listIncomes();
      setIncomes(fresh);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const updateLine = (idx, field, value) => {
    setExtraction((prev) => {
      const copy = { ...prev };
      copy.lines = [...(copy.lines || [])];
      copy.lines[idx] = { ...copy.lines[idx], [field]: value };
      return copy;
    });
  };

  const addLine = () => {
    setExtraction((prev) => ({
      ...prev,
      lines: [
        ...(prev?.lines || []),
        {
          branch: '',
          invoice_no: '',
          machine_serial: '',
          machine_runs: 0,
          rate_rm: 0,
          amount_rm: 0,
        },
      ],
    }));
  };

  const deleteLine = (idx) => {
    setExtraction((prev) => ({
      ...prev,
      lines: (prev?.lines || []).filter((_, i) => i !== idx),
    }));
  };

  return (
    <div>
      <div className="page-header mb-4">
        <h1 className="page-title">Income / Invoices</h1>
        <p className="page-subtitle">
          Upload a Revenue Sharing Report to extract data and generate an invoice.
        </p>
      </div>

      {error && (
        <div className="pro-card mb-3" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="pro-card-body d-flex align-items-center gap-2" style={{ color: 'var(--danger)' }}>
            <FiAlertCircle /> {error}
          </div>
        </div>
      )}

      {/* Upload Zone */}
      {!extraction && !isExtracting && (
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
                PDF, PNG, or JPG — AI will extract the invoice details automatically
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Extraction Loading State */}
      {isExtracting && (
        <div className="pro-card mb-4 text-center py-5">
          <FiLoader className="spin" size={40} style={{ color: 'var(--primary)' }} />
          <h5 className="mt-3">Extracting Invoice Data...</h5>
          <p style={{ color: 'var(--neutral-500)' }}>Mistral AI is reading the report.</p>
          <style>{`
            .spin { animation: spin 1s linear infinite; }
            @keyframes spin { 100% { transform: rotate(360deg); } }
          `}</style>
        </div>
      )}

      {/* Extraction Review Form */}
      {extraction && (
        <div className="pro-card mb-4">
          <div className="pro-card-header">
            <span>Review Extracted Income</span>
          </div>
          <div className="pro-card-body">

            <div className="row g-3 mb-4 p-3" style={{ background: 'var(--neutral-50)', borderRadius: '8px' }}>
              <div className="col-md-4">
                <label className="form-label-sm">Company *</label>
                <select
                  className="form-select"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                >
                  <option value="">— Select who is invoicing —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-8 d-flex align-items-end gap-2">
                <div style={{ flex: 1, maxWidth: 300 }}>
                  <label className="form-label-sm">Add new company (if not listed)</label>
                  <input
                    className="form-control"
                    placeholder="Company Name"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                  />
                </div>
                <button className="btn btn-outline-primary" onClick={handleAddCompany}>
                  + Add
                </button>
              </div>

              <div className="col-md-4 mt-3">
                <label className="form-label-sm">Invoice Number *</label>
                <input
                  className="form-control"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. LSI0032"
                />
              </div>

              <div className="col-md-4 mt-3">
                <label className="form-label-sm">Customer Name</label>
                <input
                  className="form-control"
                  value={extraction.customer_name || ''}
                  onChange={(e) => setExtraction({ ...extraction, customer_name: e.target.value })}
                  placeholder="e.g. MEDICARE SOLUTIONS SDN. BHD."
                />
              </div>

              <div className="col-md-4 mt-3">
                <label className="form-label-sm">Customer Address</label>
                <input
                  className="form-control"
                  value={extraction.customer_address || ''}
                  onChange={(e) => setExtraction({ ...extraction, customer_address: e.target.value })}
                />
              </div>

              <div className="col-md-3 mt-3">
                <label className="form-label-sm">Period (YYYY-MM)</label>
                <input
                  className="form-control"
                  value={extraction.period || ''}
                  onChange={(e) => setExtraction({ ...extraction, period: e.target.value })}
                />
              </div>

              <div className="col-md-3 mt-3">
                <label className="form-label-sm">Date Issued</label>
                <input
                  type="date"
                  className="form-control"
                  value={extraction.date_issued || ''}
                  onChange={(e) => setExtraction({ ...extraction, date_issued: e.target.value })}
                />
              </div>

              <div className="col-md-3 mt-3">
                <label className="form-label-sm">Statement Ref</label>
                <input
                  className="form-control"
                  value={extraction.statement_ref || ''}
                  onChange={(e) => setExtraction({ ...extraction, statement_ref: e.target.value })}
                />
              </div>
            </div>

            {/* Line Items */}
            <table className="pro-table mb-4">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Branch / Description</th>
                  <th>Invoice No</th>
                  <th>Machine Serial</th>
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
                      <input
                        className="form-control"
                        value={line.branch || ''}
                        onChange={(e) => updateLine(idx, 'branch', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="form-control"
                        value={line.invoice_no || ''}
                        onChange={(e) => updateLine(idx, 'invoice_no', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="form-control"
                        value={line.machine_serial || ''}
                        onChange={(e) => updateLine(idx, 'machine_serial', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-control"
                        value={line.machine_runs || 0}
                        onChange={(e) => updateLine(idx, 'machine_runs', parseInt(e.target.value) || 0)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={line.rate_rm || 0}
                        onChange={(e) => updateLine(idx, 'rate_rm', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={line.amount_rm || 0}
                        onChange={(e) => updateLine(idx, 'amount_rm', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => deleteLine(idx)}>
                        <FiTrash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {(extraction.lines || []).length === 0 && (
                  <tr>
                    <td colSpan="8" className="text-center py-3" style={{ color: 'var(--neutral-500)' }}>
                      No line items extracted. Click "Add Line" below.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Totals */}
            <div className="row g-3 mb-4">
              <div className="col-md-3">
                <label className="form-label-sm">Total RM</label>
                <input
                  type="number"
                  className="form-control"
                  value={extraction.total_rm || 0}
                  onChange={(e) => setExtraction({ ...extraction, total_rm: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label-sm">Total HKD (optional)</label>
                <input
                  type="number"
                  className="form-control"
                  value={extraction.total_hkd || ''}
                  onChange={(e) =>
                    setExtraction({
                      ...extraction,
                      total_hkd: e.target.value === '' ? null : parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            <div className="d-flex justify-content-between mt-3">
              <button className="btn btn-outline-primary" onClick={addLine}>
                <FiPlus size={14} /> Add Line
              </button>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary" onClick={() => setExtraction(null)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={busy || !companyId}>
                  {busy ? 'Saving...' : 'Save & Create Invoice'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Existing Invoices List */}
      <div className="pro-card">
        <div className="pro-card-header">
          <span>Generated Invoices ({incomes.length})</span>
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
              <th style={{ width: '180px' }}></th>
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
                  RM {num(inc.total_rm).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td>
                  <span className={`status-badge status-${inc.status}`}>{inc.status}</span>
                </td>
                <td>
                  <div className="d-flex gap-2">
                    <Link to={`/income/${inc.id}`} className="btn btn-sm btn-outline-primary">
                      <FiEye size={14} /> View
                    </Link>
                    <button
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => window.open(`${API_BASE_URL}/api/incomes/${inc.id}/export/word`, '_blank')}
                    >
                      <FiDownload size={14} />
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDelete(inc.id, inc.invoice_number)}
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {incomes.length === 0 && (
              <tr>
                <td colSpan="7" className="text-center py-4" style={{ color: 'var(--neutral-500)' }}>
                  No invoices generated yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}