import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  FiSave, FiPlus, FiTrash2, FiArrowLeft,
  FiCheckCircle, FiAlertCircle, FiAlertTriangle,
} from 'react-icons/fi';
import {
  getExtractedData, saveReview, getCategories,
  getCompanies, getCompanyCategories, getPayees, createPayee,
  getSuggestions, createNature,
} from '../services/api';

function Review() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const docId = searchParams.get('doc');

  const [categories, setCategories] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [companyCategories, setCompanyCategories] = useState({});
  const [payees, setPayees] = useState([]);

  // Form state
  const [companyId, setCompanyId] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [natureId, setNatureId] = useState('');
  const [natureName, setNatureName] = useState('');
  const [payee, setPayee] = useState('');
  const [period, setPeriod] = useState('');
  const [subGroup, setSubGroup] = useState('');       // 👈 NEW
  const [newPayeeName, setNewPayeeName] = useState('');
  const [newNatureName, setNewNatureName] = useState('');
  const [sharedDate, setSharedDate] = useState('');

  // Data state
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [autoFilled, setAutoFilled] = useState(false);
  const [aiPayeeName, setAiPayeeName] = useState(null);
  const [documentTotal, setDocumentTotal] = useState(null);

  const lastItemRef = useRef(null);

  // Nature helpers
  const natureKey = (natureName || '').trim().toLowerCase();
  const paymentTypeKey = (paymentType || '').trim().toLowerCase();

  const isReimbursement = natureKey === 'reimbursement';
  const isMpf = natureKey.startsWith('mpf');           // 👈 NEW

  const FREE_FORM_NATURES = ['group medical', 'mpf'];
  const isFreeForm =
    natureKey.startsWith('ad hoc') ||
    paymentTypeKey === 'ad hoc' ||
    FREE_FORM_NATURES.includes(natureKey);

  // -----------------------------------------------------------
  // Load lookups once
  // -----------------------------------------------------------
  useEffect(() => {
    Promise.all([getCategories(), getCompanies(), getPayees()])
      .then(([cats, comps, pys]) => {
        setCategories(cats);
        setCompanies(comps);
        setPayees(pys);
      })
      .catch((err) => console.error('Failed to load lookups:', err));
  }, []);

  // -----------------------------------------------------------
  // Load extracted data + suggestions
  // -----------------------------------------------------------
  useEffect(() => {
    if (!docId) return;

    Promise.all([getExtractedData(docId), getSuggestions(docId)])
      .then(async ([data, sug]) => {
        const realItems = (data.items || []).filter((it) => !it.is_total);
        setItems(realItems);
        setAiPayeeName(sug.ai_payee_name || null);

        if (data.total_amount !== undefined && data.total_amount !== null) {
          setDocumentTotal(Number(data.total_amount));
        } else {
          setDocumentTotal(null);
        }

        if (sug.company_id) {
          setCompanyId(sug.company_id);
          try {
            const map = await getCompanyCategories(sug.company_id);
            setCompanyCategories(map);

            if (sug.payment_type && map[sug.payment_type]) {
              setPaymentType(sug.payment_type);
            }
            if (sug.payment_category_id) {
              setNatureId(sug.payment_category_id);
              setNatureName(sug.payment_category_name || '');
            }
          } catch (err) {
            console.error('Failed to load company categories:', err);
          }
        }

        if (sug.period) setPeriod(sug.period);

        setSharedDate(new Date().toISOString().split('T')[0]);

        if (sug.company_id || sug.payee_name || sug.period) {
          setAutoFilled(true);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [docId]);

  // -----------------------------------------------------------
  // Refresh categories when company changes
  // -----------------------------------------------------------
  useEffect(() => {
    if (!companyId) {
      setCompanyCategories({});
      setPaymentType('');
      setNatureId('');
      setNatureName('');
      return;
    }
    if (autoFilled && Object.keys(companyCategories).length > 0) return;

    getCompanyCategories(companyId)
      .then((map) => {
        setCompanyCategories(map);
        setPaymentType('');
        setNatureId('');
        setNatureName('');
      })
      .catch((err) => console.error(err));
  }, [companyId]);

  // -----------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------
  const handleChange = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
    setSaved(false);
  };

  const handleAdd = () => {
    const newItem = {
      item_number: items.length + 1,
      date: isFreeForm ? sharedDate : '',
      description: '',
      amount_hkd: 0,
      category: isReimbursement ? (categories[0] || null) : null,
      is_total: false,
    };
    setItems([...items, newItem]);
    setSaved(false);

    setTimeout(() => {
      if (lastItemRef.current) {
        lastItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

  const handleDelete = (index) => {
    setItems(items.filter((_, i) => i !== index));
    setSaved(false);
  };

  const handleAddPayee = async () => {
    const name = newPayeeName.trim();
    if (!name) return;
    try {
      const created = await createPayee(name);
      const fresh = await getPayees();
      setPayees(fresh);
      setPayee(created.name);
      setNewPayeeName('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddNature = async () => {
    const name = newNatureName.trim();
    if (!name) return;
    if (!companyId) return setError('Please select a company before adding a new nature.');
    if (!paymentType) return setError('Please select a payment type before adding a new nature.');

    try {
      const created = await createNature(companyId, name, paymentType);
      const fresh = await getCompanyCategories(companyId);
      setCompanyCategories(fresh);
      setNatureId(created.id);
      setNatureName(created.name);
      setNewNatureName('');
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const handleSave = async () => {
    if (!companyId) return setError('Please select a company.');
    if (!paymentType) return setError('Please select a payment type.');
    if (!natureId) return setError('Please select a nature.');
    if (!payee) return setError('Please select a payee.');
    if (!period || !/^\d{4}-\d{2}$/.test(period))
      return setError('Please select a period (YYYY-MM).');
    if (items.length === 0) return setError('Please add at least one item.');
    if (isFreeForm && !sharedDate) return setError('Please select a date.');

    setSaving(true);
    setError(null);
    try {
      const payload = items.map((it) => ({
        ...it,
        category: isReimbursement ? (it.category || null) : null,
        date: isFreeForm ? (sharedDate || null) : (it.date || null),
        is_total: false,
      }));

      await saveReview(docId, {
        items: payload,
        company_id: companyId,
        payment_category_id: natureId,
        payee_name: payee,
        period: period || null,
        sub_group: subGroup.trim() || null,          // 👈 send sub_group
      });
      setSaved(true);
      setTimeout(() => navigate('/requisitions'), 1000);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setSaving(false);
    }
  };

  const sumOfItems = items.reduce(
    (sum, i) => sum + (parseFloat(i.amount_hkd) || 0),
    0
  );

  const documentMismatch =
    documentTotal !== null && Math.abs(documentTotal - sumOfItems) > 0.01;

  const paymentTypes = Object.keys(companyCategories);
  const categoriesForType = paymentType ? companyCategories[paymentType] || [] : [];

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner-border text-primary" role="status" />
        <div className="mt-3">Loading extracted data...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <button
            className="btn btn-sm btn-outline-primary mb-2 d-flex align-items-center gap-1"
            onClick={() => navigate(-1)}
          >
            <FiArrowLeft size={14} /> Back
          </button>
          <h1 className="page-title mb-1">Review Extracted Data</h1>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-primary d-flex align-items-center gap-2"
            onClick={handleAdd}
          >
            <FiPlus size={16} /> Add Row
          </button>
          <button
            className="btn btn-primary d-flex align-items-center gap-2"
            onClick={handleSave}
            disabled={saving || saved}
          >
            {saved ? (
              <><FiCheckCircle size={16} /> Saved</>
            ) : saving ? (
              <><span className="spinner-border spinner-border-sm" /> Saving...</>
            ) : (
              <><FiSave size={16} /> Save & Create PR</>
            )}
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

      {documentMismatch && (
        <div className="pro-card mb-3" style={{ borderLeft: '4px solid var(--warning)', background: '#fffbeb' }}>
          <div className="pro-card-body d-flex align-items-start gap-2" style={{ color: '#92400e' }}>
            <FiAlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Line items do not match the document's total.</strong>
              <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Document total: <strong>HK${documentTotal.toFixed(2)}</strong> ·
                Sum of line items: <strong>HK${sumOfItems.toFixed(2)}</strong>
                {' '}(difference of HK${Math.abs(documentTotal - sumOfItems).toFixed(2)})
              </div>
            </div>
          </div>
        </div>
      )}

      {isFreeForm && (
        <div className="pro-card mb-3" style={{ borderLeft: '4px solid var(--warning)', background: '#fffbeb' }}>
          <div className="pro-card-body d-flex align-items-center gap-2" style={{ color: '#92400e', fontSize: '0.875rem' }}>
             <strong>Free-form mode.</strong> Add as many line items as you need. The date applies to the whole PR.
          </div>
        </div>
      )}

      {saved && (
        <div className="pro-card mb-3" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="pro-card-body d-flex align-items-center gap-2" style={{ color: 'var(--success)' }}>
            <FiCheckCircle /> Saved. Redirecting...
          </div>
        </div>
      )}

      {/* 5 dropdowns + sub-group */}
      <div className="pro-card mb-3">
        <div className="pro-card-body">
          <div className="row g-3">
            <div className="col-md-3">
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

            <div className="col-md-2">
              <label className="form-label-sm">Payment Type *</label>
              <select
                className="form-select"
                value={paymentType}
                disabled={!companyId}
                onChange={(e) => {
                  setPaymentType(e.target.value);
                  setNatureId('');
                  setNatureName('');
                }}
              >
                <option value="">— Select —</option>
                {paymentTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="col-md-2">
              <label className="form-label-sm">Nature *</label>
              <select
                className="form-select"
                value={natureId}
                disabled={!paymentType}
                onChange={(e) => {
                  setNatureId(e.target.value);
                  const found = categoriesForType.find((c) => c.id === e.target.value);
                  setNatureName(found ? found.name : '');
                }}
              >
                <option value="">— Select —</option>
                {categoriesForType.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="col-md-2">
              <label className="form-label-sm">Payee *</label>
              <select
                className="form-select"
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
              >
                <option value="">— Select —</option>
                {payees.map((p) => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label-sm">Period *</label>
              <input
                type="month"
                className="form-control"
                value={period && /^\d{4}-\d{2}$/.test(period) ? period : ''}
                onChange={(e) => setPeriod(e.target.value)}
                style={{
                  borderColor: !period ? 'var(--danger)' : undefined,
                }}
              />
            </div>
          </div>

          {/* MPF Package / Sub-group — only shown when Nature is MPF */}
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
                <div style={{ fontSize: '0.7rem', color: 'var(--neutral-500)', marginTop: '0.25rem' }}>
                  Optional. Use a different value per PR to keep them separate.
                </div>
              </div>
            </div>
          )}

          <div className="row g-3 mt-2">
            <div className="col-md-6 d-flex align-items-end gap-2">
              <div style={{ flex: 1 }}>
                <label className="form-label-sm">Add new payee (if not listed)</label>
                <input
                  className="form-control"
                  placeholder="Full name"
                  value={newPayeeName}
                  onChange={(e) => setNewPayeeName(e.target.value)}
                />
              </div>
              <button className="btn btn-outline-primary" onClick={handleAddPayee}>
                + Add payee
              </button>
            </div>

            <div className="col-md-6 d-flex align-items-end gap-2">
              <div style={{ flex: 1 }}>
                <label className="form-label-sm">
                  Add new nature (if not listed)
                  {paymentType && <> · under <strong>{paymentType}</strong></>}
                </label>
                <input
                  className="form-control"
                  placeholder="New nature name"
                  value={newNatureName}
                  onChange={(e) => setNewNatureName(e.target.value)}
                  disabled={!companyId || !paymentType}
                />
              </div>
              <button
                className="btn btn-outline-primary"
                onClick={handleAddNature}
                disabled={!companyId || !paymentType}
              >
                + Add nature
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Items editor */}
      <div className="pro-card">
        <div className="pro-card-header">
          <span>Line Items ({items.length})</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', fontWeight: 400 }}>
            {isFreeForm ? 'One row per particular' : 'Click any cell to edit'}
          </span>
        </div>

        {isFreeForm ? (
          /* ---------- FREE-FORM MODE ---------- */
          <div className="pro-card-body">
            <div className="mb-4" style={{ maxWidth: 250 }}>
              <label className="form-label-sm">Date *</label>
              <input
                type="date"
                className="form-control"
                value={sharedDate}
                onChange={(e) => setSharedDate(e.target.value)}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', marginTop: '0.25rem' }}>
                Applies to the whole PR — only shown once in the Word document
              </div>
            </div>

            {items.length === 0 && (
              <div
                className="text-center py-4 mb-3"
                style={{
                  border: '2px dashed var(--neutral-300)',
                  borderRadius: 8,
                  color: 'var(--neutral-500)',
                }}
              >
                No line items yet. Click <strong>+ Add Line Item</strong> below to start.
              </div>
            )}

            {items.map((item, idx) => (
              <div
                key={idx}
                ref={idx === items.length - 1 ? lastItemRef : null}
                className="mb-3 pb-3"
                style={{ borderBottom: '1px solid var(--neutral-200)' }}
              >
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-500)' }}>
                    Item {idx + 1}
                  </span>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => handleDelete(idx)}
                  >
                    <FiTrash2 size={14} /> Remove
                  </button>
                </div>
                <label className="form-label-sm">Particular *</label>
                <textarea
                  className="form-control mb-2"
                  rows="4"
                  placeholder="Type the particular text exactly as it should appear on the PR."
                  value={item.description || ''}
                  onChange={(e) => handleChange(idx, 'description', e.target.value)}
                  style={{ fontFamily: 'inherit', fontSize: '0.875rem' }}
                />
                <label className="form-label-sm">Amount (HKD) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  style={{ maxWidth: 250, textAlign: 'right' }}
                  value={item.amount_hkd || 0}
                  onChange={(e) =>
                    handleChange(idx, 'amount_hkd', parseFloat(e.target.value) || 0)
                  }
                />
              </div>
            ))}

            <button
              className="btn btn-outline-primary d-flex align-items-center gap-2 mt-3"
              onClick={handleAdd}
              style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
            >
              <FiPlus size={16} /> Add Line Item
            </button>

            <div
              className="d-flex justify-content-end mt-4 pt-3"
              style={{ borderTop: '2px solid var(--neutral-300)' }}
            >
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>
                Total: HK${sumOfItems.toFixed(2)}
              </div>
            </div>
          </div>
        ) : (
          /* ---------- NORMAL / REIMBURSEMENT MODE ---------- */
          <div>
            {items.length === 0 && (
              <div
                className="text-center py-4 m-3"
                style={{
                  border: '2px dashed var(--neutral-300)',
                  borderRadius: 8,
                  color: 'var(--neutral-500)',
                }}
              >
                No line items yet. Click <strong>+ Add Line Item</strong> below to start.
              </div>
            )}

            {items.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table className="pro-table">
                  <thead>
                    <tr>
                      <th style={{ width: 50 }}>#</th>
                      <th style={{ width: 160 }}>Date</th>
                      <th>Description</th>
                      {isReimbursement && (
                        <th style={{ width: 240 }}>Category</th>
                      )}
                      <th style={{ width: 150, textAlign: 'right' }}>Amount (HKD)</th>
                      <th style={{ width: 60 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr
                        key={idx}
                        ref={idx === items.length - 1 ? lastItemRef : null}
                      >
                        <td style={{ color: 'var(--neutral-500)', fontWeight: 500 }}>
                          {idx + 1}
                        </td>
                        <td>
                          <input
                            type="date"
                            className="form-control"
                            value={item.date ? String(item.date).split('T')[0] : ''}
                            onChange={(e) => handleChange(idx, 'date', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control"
                            value={item.description || ''}
                            onChange={(e) => handleChange(idx, 'description', e.target.value)}
                          />
                        </td>
                        {isReimbursement && (
                          <td>
                            <select
                              className="form-select"
                              value={item.category || ''}
                              onChange={(e) => handleChange(idx, 'category', e.target.value)}
                            >
                              <option value="">— Select —</option>
                              {categories.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </td>
                        )}
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            className="form-control"
                            style={{ textAlign: 'right' }}
                            value={item.amount_hkd || 0}
                            onChange={(e) =>
                              handleChange(idx, 'amount_hkd', parseFloat(e.target.value) || 0)
                            }
                          />
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDelete(idx)}
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--neutral-50)' }}>
                      <td
                        colSpan={isReimbursement ? 4 : 3}
                        style={{ textAlign: 'right', fontWeight: 600, padding: '1rem' }}
                      >
                        Total:
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          color: 'var(--primary)',
                          padding: '1rem',
                        }}
                      >
                        HK${sumOfItems.toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>

                {documentTotal !== null && !documentMismatch && (
                  <div
                    className="p-3 d-flex justify-content-end"
                    style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}
                  >
                    ✓ Matches the document's total (HK${documentTotal.toFixed(2)})
                  </div>
                )}
              </div>
            )}

            <div className="p-3">
              <button
                className="btn btn-outline-primary d-flex align-items-center gap-2"
                onClick={handleAdd}
                style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
              >
                <FiPlus size={16} /> Add Line Item
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .form-label-sm {
          font-size: 0.75rem;
          color: var(--neutral-500);
          text-transform: uppercase;
          font-weight: 600;
          margin-bottom: 0.25rem;
          display: block;
        }
      `}</style>
    </div>
  );
}

export default Review;