import React, { useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Link } from 'react-router-dom';
import {
  FiUploadCloud, FiDownload, FiPlus, FiTrash2, FiAlertCircle,
  FiLoader, FiEye,
} from 'react-icons/fi';
import {
  getCompanies,
  getCompanyCategories,
  getPayees,
  createPayee,
  createNature,
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
  const [payees, setPayees] = useState([]);
  const [companyCategories, setCompanyCategories] = useState({});
  const [incomes, setIncomes] = useState([]);

  const [extraction, setExtraction] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const [companyId, setCompanyId] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [natureId, setNatureId] = useState('');
  const [natureName, setNatureName] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [period, setPeriod] = useState('');
  const [subGroup, setSubGroup] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [newPayeeName, setNewPayeeName] = useState('');
  const [newNatureName, setNewNatureName] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const lastItemRef = useRef(null);

  const natureKey = (natureName || '').trim().toLowerCase();
  const isMpf = natureKey.startsWith('mpf');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [comps, pys, incs] = await Promise.all([
        getCompanies(),
        getPayees(),
        listIncomes(),
      ]);
      setCompanies(comps);
      setPayees(pys);
      setIncomes(incs);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  useEffect(() => {
    if (!companyId) {
      setCompanyCategories({});
      setPaymentType('');
      setNatureId('');
      setNatureName('');
      return;
    }
    getCompanyCategories(companyId)
      .then((map) => {
        setCompanyCategories(map);
        setPaymentType('');
        setNatureId('');
        setNatureName('');
      })
      .catch((err) => console.error(err));
  }, [companyId]);

  useEffect(() => {
    if (!companyId) {
      setInvoiceNumber('');
      return;
    }
    const selected = companies.find((c) => c.id === companyId);
    if (!selected) return;
    const prefix = (selected.short_name || 'LSI').toUpperCase();
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
      setExtraction({ ...result, lines: Array.isArray(result.lines) ? result.lines : [] });
      if (result.period) setPeriod(result.period);
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

  const handleAddPayee = async () => {
    const name = newPayeeName.trim();
    if (!name) return;
    try {
      const created = await createPayee(name);
      setPayees(await getPayees());
      setPayeeName(created.name);
      setNewPayeeName('');
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const handleAddNature = async () => {
    const name = newNatureName.trim();
    if (!name) return;
    if (!companyId) return setError('Please select a company first.');
    if (!paymentType) return setError('Please select a payment type first.');
    try {
      const created = await createNature(companyId, name, paymentType);
      setCompanyCategories(await getCompanyCategories(companyId));
      setNatureId(created.id);
      setNatureName(created.name);
      setNewNatureName('');
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const handleAddCompany = async () => {
    const name = newCompanyName.trim();
    if (!name) return;
    try {
      const created = await createCompany(name, name.substring(0, 4));
      setCompanies(await getCompanies());
      setCompanyId(created.id);
      setNewCompanyName('');
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
        { branch: '', invoice_no: '', machine_serial: '', machine_runs: 0, rate_rm: 0, amount_rm: 0 },
      ],
    }));
    setTimeout(() => {
      if (lastItemRef.current) lastItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const deleteLine = (idx) => {
    setExtraction((prev) => ({
      ...prev,
      lines: (prev?.lines || []).filter((_, i) => i !== idx),
    }));
  };

  const resetForm = () => {
    setExtraction(null);
    setCompanyId('');
    setPaymentType('');
    setNatureId('');
    setNatureName('');
    setPayeeName('');
    setPeriod('');
    setSubGroup('');
    setInvoiceNumber('');
  };

  const handleSave = async () => {
    if (!companyId) return setError('Please select a company.');
    if (!paymentType) return setError('Please select a payment type.');
    if (!natureId) return setError('Please select a nature.');
    if (!payeeName) return setError('Please select a payee.');
    if (!invoiceNumber) return setError('Invoice number is required.');
    if (!extraction) return setError('No extraction data to save.');

    const customerName = (extraction.customer_name || '').trim();
    if (!customerName) return setError('Customer name is required.');

    setBusy(true);
    setError(null);
    try {
      await createIncome({
        ...extraction,
        customer_name: customerName,
        company_id: companyId,
        payment_category_id: natureId,
        payee_name: payeeName,
        invoice_number: invoiceNumber,
        period: period || null,
        sub_group: subGroup.trim() || null,
        lines: extraction.lines || [],
      });
      resetForm();
      setIncomes(await listIncomes());
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
      setIncomes(await listIncomes());
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const paymentTypes = Object.keys(companyCategories);
  const categoriesForType = paymentType ? companyCategories[paymentType] || [] : [];
  const customerNameMissing = extraction && !(extraction.customer_name || '').trim();

  return (
    <div>
      <div className="page-header mb-4 d-flex justify-content-between align-items-start flex-wrap gap-3">
        <div>
          <h1 className="page-title">Income / Invoices</h1>
          <p className="page-subtitle">
            Upload a Revenue Sharing Report to extract data and generate an invoice.
          </p>
        </div>
        <Link to="/invoices" className="btn btn-outline-primary">
          📁 Browse by folder
        </Link>
      </div>

      {error && (
        <div className="pro-card mb-3" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="pro-card-body d-flex align-items-center gap-2" style={{ color: 'var(--danger)' }}>
            <FiAlertCircle /> {error}
          </div>
        </div>
      )}

      {!extraction && !isExtracting && (
        <div className="pro-card mb-4">
          <div className="pro-card-body">
            <div {...getRootProps()} className={`upload-zone ${isDragActive ? 'active' : ''}`}>
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

      {isExtracting && (
        <div className="pro-card mb-4 text-center py-5">
          <FiLoader className="spin" size={40} style={{ color: 'var(--primary)' }} />
          <h5 className="mt-3">Extracting Invoice Data...</h5>
          <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{100%{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {extraction && (
        <>
          <div className="pro-card mb-3">
            <div className="pro-card-body">
              <div className="row g-3">
                <div className="col-md-3">
                  <label className="form-label-sm">Company *</label>
                  <select className="form-select" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                    <option value="">— Select —</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label-sm">Payment Type *</label>
                  <select
                    className="form-select" value={paymentType} disabled={!companyId}
                    onChange={(e) => { setPaymentType(e.target.value); setNatureId(''); setNatureName(''); }}
                  >
                    <option value="">— Select —</option>
                    {paymentTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label-sm">Nature *</label>
                  <select
                    className="form-select" value={natureId} disabled={!paymentType}
                    onChange={(e) => {
                      setNatureId(e.target.value);
                      const found = categoriesForType.find((c) => c.id === e.target.value);
                      setNatureName(found ? found.name : '');
                    }}
                  >
                    <option value="">— Select —</option>
                    {categoriesForType.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label-sm">Payee *</label>
                  <select className="form-select" value={payeeName} onChange={(e) => setPayeeName(e.target.value)}>
                    <option value="">— Select —</option>
                    {payees.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label-sm">Period (YYYY-MM)</label>
                  <input
                    type="month" className="form-control"
                    value={period && /^\d{4}-\d{2}$/.test(period) ? period : ''}
                    onChange={(e) => setPeriod(e.target.value)}
                  />
                </div>
              </div>

              {isMpf && (
                <div className="row g-3 mt-1">
                  <div className="col-md-4">
                    <label className="form-label-sm">MPF Package / Plan</label>
                    <input
                      className="form-control"
                      placeholder="e.g. Stanley + Cole, Matao + Jason"
                      value={subGroup}
                      onChange={(e) => setSubGroup(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="row g-3 mt-2">
                <div className="col-md-4">
                  <label className="form-label-sm">Invoice Number *</label>
                  <input
                    className="form-control" value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                </div>
                <div className="col-md-4 d-flex align-items-end gap-2">
                  <div style={{ flex: 1 }}>
                    <label className="form-label-sm">Add new payee</label>
                    <input className="form-control" value={newPayeeName} onChange={(e) => setNewPayeeName(e.target.value)} />
                  </div>
                  <button className="btn btn-outline-primary" onClick={handleAddPayee}>+ Add</button>
                </div>
                <div className="col-md-4 d-flex align-items-end gap-2">
                  <div style={{ flex: 1 }}>
                    <label className="form-label-sm">Add new nature</label>
                    <input
                      className="form-control" value={newNatureName}
                      onChange={(e) => setNewNatureName(e.target.value)}
                      disabled={!companyId || !paymentType}
                    />
                  </div>
                  <button className="btn btn-outline-primary" onClick={handleAddNature} disabled={!companyId || !paymentType}>
                    + Add
                  </button>
                </div>
                <div className="col-md-4 d-flex align-items-end gap-2">
                  <div style={{ flex: 1 }}>
                    <label className="form-label-sm">Add new company</label>
                    <input className="form-control" value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} />
                  </div>
                  <button className="btn btn-outline-primary" onClick={handleAddCompany}>+ Add</button>
                </div>
                <div className="col-md-4">
                  <label className="form-label-sm">Customer Name *</label>
                  <input
                    className="form-control"
                    value={extraction.customer_name || ''}
                    onChange={(e) => setExtraction({ ...extraction, customer_name: e.target.value })}
                    style={{
                      borderColor: customerNameMissing ? 'var(--danger)' : undefined,
                    }}
                    placeholder="e.g. MEDICARE SOLUTIONS SDN. BHD."
                  />
                  {customerNameMissing && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--danger)', marginTop: '0.25rem' }}>
                      Required on the invoice's "BILLED TO" block.
                    </div>
                  )}
                </div>
                <div className="col-md-4">
                  <label className="form-label-sm">Customer Address</label>
                  <input
                    className="form-control"
                    value={extraction.customer_address || ''}
                    onChange={(e) => setExtraction({ ...extraction, customer_address: e.target.value })}
                    placeholder="Full address printed on the invoice"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label-sm">Statement Ref</label>
                  <input
                    className="form-control"
                    value={extraction.statement_ref || ''}
                    onChange={(e) => setExtraction({ ...extraction, statement_ref: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pro-card mb-3">
            <div className="pro-card-header">
              <span>Line Items ({extraction.lines?.length || 0})</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="pro-table">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>#</th>
                    <th>Branch / Description</th>
                    <th style={{ width: 140 }}>Invoice No</th>
                    <th style={{ width: 140 }}>Machine Serial</th>
                    <th style={{ width: 110, textAlign: 'center' }}>Runs</th>
                    <th style={{ width: 110, textAlign: 'right' }}>Rate (RM)</th>
                    <th style={{ width: 120, textAlign: 'right' }}>Amount (RM)</th>
                    <th style={{ width: 50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {(extraction.lines || []).map((line, idx) => (
                    <tr key={idx} ref={idx === extraction.lines.length - 1 ? lastItemRef : null}>
                      <td>{idx + 1}</td>
                      <td>
                        <input className="form-control" value={line.branch || ''} onChange={(e) => updateLine(idx, 'branch', e.target.value)} />
                      </td>
                      <td>
                        <input className="form-control" value={line.invoice_no || ''} onChange={(e) => updateLine(idx, 'invoice_no', e.target.value)} />
                      </td>
                      <td>
                        <input className="form-control" value={line.machine_serial || ''} onChange={(e) => updateLine(idx, 'machine_serial', e.target.value)} />
                      </td>
                      <td>
                        <input type="number" className="form-control" value={line.machine_runs || 0} onChange={(e) => updateLine(idx, 'machine_runs', parseInt(e.target.value) || 0)} />
                      </td>
                      <td>
                        <input type="number" step="0.01" className="form-control" value={line.rate_rm || 0} onChange={(e) => updateLine(idx, 'rate_rm', parseFloat(e.target.value) || 0)} />
                      </td>
                      <td>
                        <input type="number" step="0.01" className="form-control" value={line.amount_rm || 0} onChange={(e) => updateLine(idx, 'amount_rm', parseFloat(e.target.value) || 0)} />
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
                      <td colSpan="8" className="text-center py-4" style={{ color: 'var(--neutral-500)' }}>
                        No line items. Click "Add Line" below.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-3">
              <button className="btn btn-outline-primary w-100" onClick={addLine}>
                <FiPlus size={14} /> Add Line
              </button>
            </div>
          </div>

          <div className="pro-card mb-3">
            <div className="pro-card-body">
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label-sm">Total RM</label>
                  <input
                    type="number" className="form-control"
                    value={extraction.total_rm || 0}
                    onChange={(e) => setExtraction({ ...extraction, total_rm: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label-sm">Total HKD (optional)</label>
                  <input
                    type="number" className="form-control"
                    value={extraction.total_hkd || ''}
                    onChange={(e) => setExtraction({
                      ...extraction,
                      total_hkd: e.target.value === '' ? null : parseFloat(e.target.value) || 0,
                    })}
                  />
                </div>
              </div>

              <div className="d-flex justify-content-between mt-3">
                <button className="btn btn-outline-secondary" onClick={resetForm}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={busy || !companyId || customerNameMissing}
                >
                  {busy ? 'Saving...' : 'Save & Create Invoice'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

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
              <th>Payee</th>
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
                <td>{inc.payee_name || '—'}</td>
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
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(inc.id, inc.invoice_number)}>
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {incomes.length === 0 && (
              <tr>
                <td colSpan="8" className="text-center py-4" style={{ color: 'var(--neutral-500)' }}>
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