import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiArrowLeft, FiDownload, FiTrash2, FiAlertCircle,
  FiEdit3, FiSave, FiX, FiPlus,
} from 'react-icons/fi';
import {
  getRequisition,
  updateRequisition,
  deleteRequisition,
  getCompanies,
  getCompanyCategories,
  getPayees,
  getCategories,
  API_BASE_URL,
} from '../services/api';

function RequisitionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Edit mode states
  const [editing, setEditing] = useState(false);
  const [editPR, setEditPR] = useState('');
  const [editCompanyId, setEditCompanyId] = useState('');
  const [editPaymentType, setEditPaymentType] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editApplicant, setEditApplicant] = useState('');
  const [editNature, setEditNature] = useState('');
  const [editPayee, setEditPayee] = useState('');
  const [editPeriod, setEditPeriod] = useState('');
  const [editItems, setEditItems] = useState([]);

  // Lookups
  const [companies, setCompanies] = useState([]);
  const [companyCategories, setCompanyCategories] = useState({});
  const [payees, setPayees] = useState([]);
  const [lineCategories, setLineCategories] = useState([]);

  const load = async () => {
    try {
      const result = await getRequisition(id);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  // Load global lookups
  useEffect(() => {
    Promise.all([getCompanies(), getPayees(), getCategories()])
      .then(([comps, pys, cats]) => {
        setCompanies(comps);
        setPayees(pys);
        setLineCategories(cats);
      })
      .catch((err) => console.error(err));
  }, []);

  // Load company-specific categories when company changes in edit mode
  useEffect(() => {
    if (!editing || !editCompanyId) return;
    getCompanyCategories(editCompanyId)
      .then((map) => {
        setCompanyCategories(map);
        // If the current category isn't in the new company's list, reset it
        const allCats = Object.values(map).flat();
        if (!allCats.find(c => c.id === editCategoryId)) {
          setEditCategoryId('');
        }
      })
      .catch((err) => console.error(err));
  }, [editing, editCompanyId]);

  const startEditing = async () => {
    setEditPR(data.pr_number);
    setEditCompanyId(data.company_id || '');
    setEditPaymentType(data.payment_type_name || '');
    setEditCategoryId(data.payment_category_id || '');
    setEditApplicant(data.applicant || 'Juliana');
    setEditNature(data.nature || 'Payment Requisition');
    setEditPayee(data.payee_name);
    setEditPeriod(data.period || '');
    setEditItems(
      (data.line_items || []).map((li) => ({
        id: li.id,
        date: li.date ? li.date.split('T')[0] : '',
        description: li.description || '',
        amount_hkd: li.amount_hkd || 0,
        category: li.category || '',
      }))
    );

    if (data.company_id) {
      try {
        const map = await getCompanyCategories(data.company_id);
        setCompanyCategories(map);
      } catch (err) {
        console.error(err);
      }
    }

    setEditing(true);
  };

  const cancelEditing = () => setEditing(false);

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
      { date: '', description: '', amount_hkd: 0, category: '' },
    ]);
  };

  const handleDeleteItem = (idx) => {
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      const lineItemsPayload = editItems.map((it) => ({
        date: it.date || null,
        description: it.description,
        amount_hkd: parseFloat(it.amount_hkd) || 0,
        category: it.category || null,
      }));

      const payload = {
        pr_number: editPR.trim(),
        company_id: editCompanyId,
        payment_category_id: editCategoryId,
        payee_name: editPayee.trim(),
        period: editPeriod || null,
        applicant: editApplicant.trim(),      // 👈 added
        nature: editNature.trim(),            // 👈 added
        line_items: lineItemsPayload,
      };

      await updateRequisition(id, payload);
      setEditing(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${data.pr_number}?\n\nThis cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteRequisition(id);
      navigate('/requisitions');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () => {
    window.open(`${API_BASE_URL}/api/requisitions/${id}/export/word`, '_blank');
  };

  // Derived state
  const natureKey = (editing ? editNature : data?.nature) || '';
  const isReimbursement = natureKey.toLowerCase().includes('reimbursement');
  
  // Flatten categories for the dropdown
  const flatCategoriesForCompany = Object.values(companyCategories).flat();

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  if (error && !editing) {
    return (
      <div className="pro-card" style={{ borderLeft: '4px solid var(--danger)' }}>
        <div className="pro-card-body d-flex align-items-center gap-2" style={{ color: 'var(--danger)' }}>
          <FiAlertCircle /> {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  // ---------------- VIEW MODE ----------------
  if (!editing) {
    return (
      <div>
        <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-3">
          <div>
            <button
              className="btn btn-sm btn-outline-primary mb-2 d-flex align-items-center gap-1"
              onClick={() => navigate('/requisitions')}
            >
              <FiArrowLeft size={14} /> Back
            </button>
            <h1 className="page-title mb-1">{data.pr_number}</h1>
            <p className="page-subtitle">
              {data.company_name}
              {data.payment_type_name && ` · ${data.payment_type_name}`}
              {data.category_name && ` · ${data.category_name}`}
              {data.payee_name && ` · ${data.payee_name}`}
              {data.period && ` · ${data.period}`}
            </p>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button className="btn btn-outline-primary d-flex align-items-center gap-2" onClick={startEditing}>
              <FiEdit3 size={16} /> Edit
            </button>
            <button className="btn btn-primary d-flex align-items-center gap-2" onClick={handleDownload}>
              <FiDownload size={16} /> Download Word
            </button>
            <button className="btn btn-outline-danger d-flex align-items-center gap-2" onClick={handleDelete} disabled={busy}>
              <FiTrash2 size={16} /> Delete
            </button>
          </div>
        </div>

        <div className="row g-3 mb-4">
          <div className="col-md-8">
            <div className="pro-card" style={{ marginBottom: 0 }}>
              <div className="pro-card-header">
                <span>Requisition Info</span>
                <span className={`status-badge status-${data.status}`}>{data.status}</span>
              </div>
              <div className="pro-card-body">
                <div className="row g-3">
                  <div className="col-md-4"><b>Company</b><div>{data.company_name || '—'}</div></div>
                  <div className="col-md-4"><b>Applicant</b><div>{data.applicant}</div></div>
                  <div className="col-md-4"><b>Nature</b><div>{data.nature}</div></div>
                  <div className="col-md-4"><b>Payment Type</b><div>{data.payment_type_name || '—'}</div></div>
                  {isReimbursement && (
                    <div className="col-md-4"><b>Category</b><div>{data.category_name || '—'}</div></div>
                  )}
                  <div className="col-md-4"><b>Payee</b><div>{data.payee_name}</div></div>
                  {data.period && (
                    <div className="col-md-4"><b>Period</b><div>{data.period}</div></div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="pro-card" style={{ marginBottom: 0, background: 'var(--primary)', color: 'white', border: 'none' }}>
              <div className="pro-card-body">
                <div style={{ fontSize: '0.75rem', opacity: 0.85, textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Total Amount
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>
                  HK${data.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '0.5rem' }}>
                  {data.line_items?.length || 0} line items
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pro-card">
          <div className="pro-card-header"><span>Line Items</span></div>
          <table className="pro-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th style={{ width: 140 }}>Date</th>
                <th>Description</th>
                {isReimbursement && <th style={{ width: 220 }}>Category</th>}
                <th style={{ width: 150, textAlign: 'right' }}>Amount (HKD)</th>
              </tr>
            </thead>
            <tbody>
              {data.line_items.map((li, idx) => (
                <tr key={li.id}>
                  <td style={{ color: 'var(--neutral-500)', fontWeight: 500 }}>{idx + 1}</td>
                  <td>{li.date ? new Date(li.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td style={{ color: 'var(--neutral-800)' }}>{li.description}</td>
                  {isReimbursement && (
                    <td>
                      {li.category ? (
                        <span style={{ display: 'inline-block', padding: '0.2rem 0.6rem', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 4, fontSize: '0.75rem', fontWeight: 500 }}>
                          {li.category}
                        </span>
                      ) : '—'}
                    </td>
                  )}
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    ${(li.amount_hkd || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--neutral-50)' }}>
                <td colSpan={isReimbursement ? 4 : 3} style={{ textAlign: 'right', fontWeight: 600, padding: '1rem' }}>Total:</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.05rem', color: 'var(--primary)', padding: '1rem' }}>
                  HK${data.total_amount.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  // ---------------- EDIT MODE ----------------
  const editTotal = editItems.reduce((sum, it) => sum + (parseFloat(it.amount_hkd) || 0), 0);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-3">
        <div>
          <button className="btn btn-sm btn-outline-primary mb-2 d-flex align-items-center gap-1" onClick={cancelEditing}>
            <FiArrowLeft size={14} /> Cancel
          </button>
          <h1 className="page-title mb-1">Editing {data.pr_number}</h1>
          <p className="page-subtitle">Change any field below. Click Save to apply.</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-outline-secondary d-flex align-items-center gap-2" onClick={cancelEditing} disabled={busy}>
            <FiX size={16} /> Cancel
          </button>
          <button className="btn btn-primary d-flex align-items-center gap-2" onClick={handleSave} disabled={busy}>
            {busy ? <><span className="spinner-border spinner-border-sm" /> Saving...</> : <><FiSave size={16} /> Save Changes</>}
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

      {/* Editable fields */}
      <div className="pro-card mb-3">
        <div className="pro-card-header"><span>Requisition Info</span></div>
        <div className="pro-card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label-sm">PR Number *</label>
              <input className="form-control" value={editPR} onChange={(e) => setEditPR(e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label-sm">Company *</label>
              <select className="form-select" value={editCompanyId} onChange={(e) => setEditCompanyId(e.target.value)}>
                <option value="">— Select —</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label-sm">Applicant</label>
              <input className="form-control" value={editApplicant} onChange={(e) => setEditApplicant(e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label-sm">Nature</label>
              <input className="form-control" value={editNature} onChange={(e) => setEditNature(e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label-sm">Payment Type</label>
              <select className="form-select" value={editPaymentType} onChange={(e) => setEditPaymentType(e.target.value)} disabled>
                <option value={editPaymentType}>{editPaymentType || '—'}</option>
              </select>
              <div style={{ fontSize: '0.7rem', color: 'var(--neutral-500)', marginTop: '0.25rem' }}>
                (Derived from Category)
              </div>
            </div>
            
            {/* Only show Category for Reimbursements */}
            {isReimbursement && (
              <div className="col-md-4">
                <label className="form-label-sm">Category *</label>
                <select className="form-select" value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)}>
                  <option value="">— Select —</option>
                  {flatCategoriesForCompany.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            <div className="col-md-4">
              <label className="form-label-sm">Payee *</label>
              <input className="form-control" list="payee-list" value={editPayee} onChange={(e) => setEditPayee(e.target.value)} />
              <datalist id="payee-list">
                {payees.map((p) => <option key={p.id} value={p.name} />)}
              </datalist>
            </div>
            <div className="col-md-4">
              <label className="form-label-sm">Period (YYYY-MM)</label>
              <input type="month" className="form-control" value={editPeriod && /^\d{4}-\d{2}$/.test(editPeriod) ? editPeriod : ''} onChange={(e) => setEditPeriod(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* Editable line items */}
      <div className="pro-card mb-3">
        <div className="pro-card-header">
          <span>Line Items ({editItems.length})</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', fontWeight: 400 }}>Add, edit, or delete rows</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="pro-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th style={{ width: 150 }}>Date</th>
                <th>Description</th>
                {isReimbursement && <th style={{ width: 220 }}>Category</th>}
                <th style={{ width: 140, textAlign: 'right' }}>Amount (HKD)</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {editItems.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ color: 'var(--neutral-500)', fontWeight: 500 }}>{idx + 1}</td>
                  <td>
                    <input type="date" className="form-control" value={item.date || ''} onChange={(e) => handleItemChange(idx, 'date', e.target.value)} />
                  </td>
                  <td>
                    <input className="form-control" value={item.description || ''} onChange={(e) => handleItemChange(idx, 'description', e.target.value)} />
                  </td>
                  {isReimbursement && (
                    <td>
                      <select className="form-select" value={item.category || ''} onChange={(e) => handleItemChange(idx, 'category', e.target.value)}>
                        <option value="">— Select —</option>
                        {lineCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                  )}
                  <td>
                    <input type="number" step="0.01" className="form-control" style={{ textAlign: 'right' }} value={item.amount_hkd || 0} onChange={(e) => handleItemChange(idx, 'amount_hkd', parseFloat(e.target.value) || 0)} />
                  </td>
                  <td>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteItem(idx)} title="Delete row"><FiTrash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--neutral-50)' }}>
                <td colSpan={isReimbursement ? 4 : 3} style={{ textAlign: 'right', fontWeight: 600, padding: '1rem' }}>Total:</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)', padding: '1rem' }}>HK${editTotal.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="p-3">
          <button className="btn btn-outline-primary d-flex align-items-center gap-2" onClick={handleAddItem} style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}>
            <FiPlus size={16} /> Add Line Item
          </button>
        </div>
      </div>
    </div>
  );
}

export default RequisitionDetail;