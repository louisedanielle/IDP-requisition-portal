import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiArrowLeft, FiDownload, FiTrash2, FiAlertCircle,
  FiEdit3, FiSave, FiX, FiPlus,
} from 'react-icons/fi';
import {
  getIncome,
  updateIncome,
  deleteIncome,
  API_BASE_URL,
} from '../services/api';

// Safely coerce a value to a number, defaulting to 0
const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

// Normalize a line item from the backend into the shape this component edits.
// Handles both the "lines"/"rate_rm" shape (what Income.js writes) and the
// legacy "line_items"/"rate" shape, so it's robust either way.
const normalizeLine = (li = {}) => ({
  id: li.id,
  branch: li.branch ?? li.description ?? '',
  invoice_no: li.invoice_no ?? '',
  machine_serial: li.machine_serial ?? '',
  machine_runs: num(li.machine_runs),
  rate_rm: num(li.rate_rm ?? li.rate),
  amount_rm: num(li.amount_rm ?? li.amount),
});

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editInvNo, setEditInvNo] = useState('');
  const [editCustomer, setEditCustomer] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPeriod, setEditPeriod] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editRef, setEditRef] = useState('');
  const [editItems, setEditItems] = useState([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getIncome(id);
      setData(result);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  // Get the line items regardless of which key the backend used
  const getLines = (d) => {
    if (!d) return [];
    const raw = d.lines ?? d.line_items ?? [];
    return Array.isArray(raw) ? raw.map(normalizeLine) : [];
  };

  const startEditing = () => {
    if (!data) return;
    setEditInvNo(data.invoice_number || '');
    setEditCustomer(data.customer_name || '');
    setEditAddress(data.customer_address || '');
    setEditPeriod(data.period || '');
    setEditDate(data.date_issued ? String(data.date_issued).split('T')[0] : '');
    setEditRef(data.statement_ref || '');
    setEditItems(getLines(data));
    setEditing(true);
  };

  const handleItemChange = (idx, field, value) => {
    setEditItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleAddItem = () => {
    setEditItems((prev) => [
      ...prev,
      { branch: '', invoice_no: '', machine_serial: '', machine_runs: 0, rate_rm: 0, amount_rm: 0 },
    ]);
  };

  const handleDeleteItem = (idx) => {
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateIncome(id, {
        invoice_number: editInvNo,
        customer_name: editCustomer,
        customer_address: editAddress,
        period: editPeriod,
        date_issued: editDate,
        statement_ref: editRef,
        // Send both `lines` and `line_items` so we're compatible with either
        // backend expectation. Extra key is harmless.
        lines: editItems,
        line_items: editItems,
      });
      setEditing(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!data) return;
    if (!window.confirm(`Delete ${data.invoice_number}?`)) return;
    setBusy(true);
    try {
      await deleteIncome(id);
      navigate('/income');
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to delete');
      setBusy(false);
    }
  };

  // -------- Loading / error states --------
  if (loading) {
    return (
      <div className="empty-state text-center py-5">
        <div className="spinner-border" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="pro-card">
        <div className="pro-card-body d-flex align-items-center gap-2" style={{ color: 'var(--danger)' }}>
          <FiAlertCircle /> {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const lines = getLines(data);
  const totalRm = num(data.total_rm);
  const totalHkd = data.total_hkd != null ? num(data.total_hkd) : null;

  // ---------------- VIEW MODE ----------------
  if (!editing) {
    return (
      <div>
        <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-3">
          <div>
            <button
              className="btn btn-sm btn-outline-primary mb-2 d-flex align-items-center gap-1"
              onClick={() => navigate('/income')}
            >
              <FiArrowLeft size={14} /> Back to Invoices
            </button>
            <h1 className="page-title mb-1">{data.invoice_number}</h1>
            <p className="page-subtitle">{data.company_name} → {data.customer_name || '—'}</p>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button className="btn btn-outline-primary d-flex align-items-center gap-2" onClick={startEditing}>
              <FiEdit3 size={16} /> Edit
            </button>
            <button
              className="btn btn-primary d-flex align-items-center gap-2"
              onClick={() => window.open(`${API_BASE_URL}/api/incomes/${id}/export/word`, '_blank')}
            >
              <FiDownload size={16} /> Download Invoice
            </button>
            <button
              className="btn btn-outline-danger d-flex align-items-center gap-2"
              onClick={handleDelete}
              disabled={busy}
            >
              <FiTrash2 size={16} /> Delete
            </button>
          </div>
        </div>

        {error && (
          <div className="pro-card mb-3" style={{ borderLeft: '4px solid var(--danger)' }}>
            <div className="pro-card-body d-flex align-items-center gap-2" style={{ color: 'var(--danger)' }}>
              <FiAlertCircle /> {error}
            </div>
          </div>
        )}

        {/* Info Cards */}
        <div className="row g-3 mb-4">
          <div className="col-md-8">
            <div className="pro-card" style={{ marginBottom: 0 }}>
              <div className="pro-card-header"><span>Invoice Info</span></div>
              <div className="pro-card-body">
                <div className="row g-3">
                  <div className="col-md-6"><b>Issued By</b><div>{data.company_name || '—'}</div></div>
                  <div className="col-md-6"><b>Customer</b><div>{data.customer_name || '—'}</div></div>
                  <div className="col-md-6"><b>Address</b><div>{data.customer_address || '—'}</div></div>
                  <div className="col-md-3"><b>Period</b><div>{data.period || '—'}</div></div>
                  <div className="col-md-3">
                    <b>Date Issued</b>
                    <div>{data.date_issued ? new Date(data.date_issued).toLocaleDateString() : '—'}</div>
                  </div>
                  <div className="col-md-3"><b>Statement Ref</b><div>{data.statement_ref || '—'}</div></div>
                  <div className="col-md-3">
                    <b>Status</b>
                    <div><span className={`status-badge status-${data.status || 'draft'}`}>{data.status || 'draft'}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="pro-card" style={{ marginBottom: 0, background: 'var(--success)', color: 'white', border: 'none' }}>
              <div className="pro-card-body">
                <div style={{ fontSize: '0.75rem', opacity: 0.85, textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Total Amount
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>
                  RM {totalRm.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                {totalHkd != null && (
                  <div style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    ≈ HK${totalHkd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="pro-card">
          <div className="pro-card-header"><span>Line Items ({lines.length})</span></div>
          <table className="pro-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>Branch / Description</th>
                <th style={{ width: 150 }}>Invoice No</th>
                <th style={{ width: 150 }}>Machine Serial</th>
                <th style={{ width: 120, textAlign: 'center' }}>Runs</th>
                <th style={{ width: 100, textAlign: 'right' }}>Rate</th>
                <th style={{ width: 120, textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((li, idx) => (
                <tr key={li.id ?? idx}>
                  <td>{idx + 1}</td>
                  <td>{li.branch || '—'}</td>
                  <td>{li.invoice_no || '—'}</td>
                  <td>{li.machine_serial || '—'}</td>
                  <td style={{ textAlign: 'center' }}>{li.machine_runs}</td>
                  <td style={{ textAlign: 'right' }}>{li.rate_rm.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{li.amount_rm.toFixed(2)}</td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center py-4" style={{ color: 'var(--neutral-500)' }}>
                    No line items.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ---------------- EDIT MODE ----------------
  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <button
            className="btn btn-sm btn-outline-primary mb-2 d-flex align-items-center gap-1"
            onClick={() => setEditing(false)}
          >
            <FiArrowLeft size={14} /> Cancel
          </button>
          <h1 className="page-title mb-1">Editing {data.invoice_number}</h1>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary" onClick={() => setEditing(false)} disabled={busy}>
            <FiX size={16} /> Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={busy}>
            <FiSave size={16} /> {busy ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && (
        <div className="pro-card mb-3" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="pro-card-body d-flex align-items-center gap-2" style={{ color: 'var(--danger)' }}>
            <FiAlertCircle /> {error}
          </div>
        </div>
      )}

      <div className="pro-card mb-3">
        <div className="pro-card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label-sm">Invoice Number</label>
              <input className="form-control" value={editInvNo} onChange={(e) => setEditInvNo(e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label-sm">Customer Name</label>
              <input className="form-control" value={editCustomer} onChange={(e) => setEditCustomer(e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label-sm">Customer Address</label>
              <input className="form-control" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label-sm">Period</label>
              <input className="form-control" value={editPeriod} onChange={(e) => setEditPeriod(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label-sm">Date Issued</label>
              <input type="date" className="form-control" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label-sm">Statement Ref</label>
              <input className="form-control" value={editRef} onChange={(e) => setEditRef(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="pro-card mb-3">
        <div className="pro-card-header"><span>Line Items ({editItems.length})</span></div>
        <table className="pro-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Branch / Description</th>
              <th>Invoice No</th>
              <th>Machine Serial</th>
              <th>Runs</th>
              <th>Rate</th>
              <th>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {editItems.map((item, idx) => (
              <tr key={item.id ?? idx}>
                <td>{idx + 1}</td>
                <td>
                  <input
                    className="form-control"
                    value={item.branch}
                    onChange={(e) => handleItemChange(idx, 'branch', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="form-control"
                    value={item.invoice_no}
                    onChange={(e) => handleItemChange(idx, 'invoice_no', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="form-control"
                    value={item.machine_serial}
                    onChange={(e) => handleItemChange(idx, 'machine_serial', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="form-control"
                    value={item.machine_runs}
                    onChange={(e) => handleItemChange(idx, 'machine_runs', parseInt(e.target.value) || 0)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={item.rate_rm}
                    onChange={(e) => handleItemChange(idx, 'rate_rm', parseFloat(e.target.value) || 0)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={item.amount_rm}
                    onChange={(e) => handleItemChange(idx, 'amount_rm', parseFloat(e.target.value) || 0)}
                  />
                </td>
                <td>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteItem(idx)}>
                    <FiTrash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {editItems.length === 0 && (
              <tr>
                <td colSpan="8" className="text-center py-4" style={{ color: 'var(--neutral-500)' }}>
                  No line items. Click "Add Line Item" below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="p-3">
          <button className="btn btn-outline-primary w-100" onClick={handleAddItem}>
            <FiPlus size={16} /> Add Line Item
          </button>
        </div>
      </div>
    </div>
  );
}