import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FiChevronRight, FiChevronDown, FiEye, FiTrash2,
  FiDownload, FiFolder, FiCalendar, FiUser,
} from 'react-icons/fi';
import { getIncomeFolders, deleteIncome, API_BASE_URL } from '../services/api';

export default function Invoices() {
  const [tree, setTree] = useState({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState({});
  const navigate = useNavigate();

  const load = async () => {
    try {
      setTree(await getIncomeFolders());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const isOpen = (key, defaultOpen = false) =>
    open[key] === undefined ? defaultOpen : open[key];

  const toggle = (key) => setOpen((prev) => ({ ...prev, [key]: !isOpen(key) }));

  const handleDelete = async (id, invNo) => {
    if (!window.confirm(`Delete ${invNo}?`)) return;
    await deleteIncome(id);
    load();
  };

  const handleDownload = (id) => {
    window.open(`${API_BASE_URL}/api/incomes/${id}/export/word`, '_blank');
  };

  if (loading) {
    return <div className="empty-state"><div className="spinner-border text-primary" role="status" /></div>;
  }

  return (
    <div>
      <div className="page-header mb-4 d-flex justify-content-between align-items-start flex-wrap gap-3">
        <h1 className="page-title">Invoices</h1>
        <Link to="/income" className="btn btn-outline-primary">+ New Invoice</Link>
      </div>

      {Object.keys(tree).length === 0 && (
        <div className="pro-card">
          <div className="pro-card-body empty-state">
            <FiFolder className="empty-state-icon" />
            <h5>No invoices yet</h5>
            <p>Upload a Revenue Sharing Report to get started</p>
          </div>
        </div>
      )}

      {Object.entries(tree).map(([company, years]) => {
        const cKey = `company::${company}`;
        const cOpen = isOpen(cKey, true);
        return (
          <div key={cKey} className="pro-card mb-3">
            <div
              className="pro-card-header"
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
              onClick={() => toggle(cKey)}
            >
              {cOpen ? <FiChevronDown /> : <FiChevronRight />}
              <FiFolder />
              <span style={{ flex: 1, fontWeight: 600 }}>{company}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>
                {Object.keys(years).length} year{Object.keys(years).length !== 1 ? 's' : ''}
              </span>
            </div>

            {cOpen && (
              <div className="pro-card-body" style={{ paddingLeft: '1.5rem' }}>
                {Object.entries(years).map(([year, months]) => {
                  const yKey = `${cKey}::year::${year}`;
                  const yOpen = isOpen(yKey, true);
                  return (
                    <div key={yKey} style={{ marginBottom: 12 }}>
                      <div
                        onClick={() => toggle(yKey)}
                        style={{
                          cursor: 'pointer', display: 'flex', alignItems: 'center',
                          gap: 8, fontWeight: 600, padding: '8px 0',
                          borderBottom: '1px solid var(--neutral-200)',
                        }}
                      >
                        {yOpen ? <FiChevronDown /> : <FiChevronRight />}
                        <FiCalendar />
                        <span>{year}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', marginLeft: 8 }}>
                          {Object.keys(months).length} month{Object.keys(months).length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {yOpen && (
                        <div style={{ marginLeft: 16, marginTop: 8 }}>
                          {Object.entries(months).map(([month, customers]) => {
                            const mKey = `${yKey}::month::${month}`;
                            const mOpen = isOpen(mKey, true);
                            return (
                              <div key={mKey} style={{ marginBottom: 12 }}>
                                <div
                                  onClick={() => toggle(mKey)}
                                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, padding: '6px 0' }}
                                >
                                  {mOpen ? <FiChevronDown /> : <FiChevronRight />}
                                  <span>📅 {month === '—' ? 'No month' : month}</span>
                                </div>

                                {mOpen && (
                                  <div style={{ marginLeft: 16, marginTop: 6 }}>
                                    {Object.entries(customers).map(([customer, invs]) => {
                                      const cuKey = `${mKey}::customer::${customer}`;
                                      const cuOpen = isOpen(cuKey, true);
                                      return (
                                        <div key={cuKey} style={{ marginBottom: 10 }}>
                                          <div
                                            onClick={() => toggle(cuKey)}
                                            style={{
                                              cursor: 'pointer', display: 'flex', alignItems: 'center',
                                              gap: 6, fontSize: '0.8125rem', fontWeight: 500,
                                              padding: '4px 0', color: 'var(--neutral-700)',
                                            }}
                                          >
                                            {cuOpen ? <FiChevronDown size={14}/> : <FiChevronRight size={14}/>}
                                            <FiUser size={12} />
                                            {customer}
                                            <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--neutral-500)' }}>
                                              ({invs.length})
                                            </span>
                                          </div>

                                          {cuOpen && (
                                            <div style={{ marginLeft: 20, marginTop: 4 }}>
                                              {invs.map((inv) => (
                                                <div
                                                  key={inv.id}
                                                  style={{
                                                    display: 'flex', alignItems: 'center', gap: 12,
                                                    padding: '8px 12px', border: '1px solid var(--neutral-200)',
                                                    borderRadius: 6, marginBottom: 6, background: 'white',
                                                  }}
                                                >
                                                  <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                                                    {inv.invoice_number}
                                                  </span>
                                                  <span style={{ color: 'var(--neutral-500)', fontSize: '0.8125rem' }}>
                                                    {inv.period || '—'}
                                                  </span>
                                                  <span style={{ flex: 1 }} />
                                                  <span style={{ fontWeight: 600 }}>
                                                    RM{(inv.total_rm || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                  </span>
                                                  <span className={`status-badge status-${inv.status}`}>{inv.status}</span>
                                                  <button className="btn btn-sm btn-outline-primary" title="View" onClick={() => navigate(`/income/${inv.id}`)}>
                                                    <FiEye size={14} />
                                                  </button>
                                                  <button className="btn btn-sm btn-outline-primary" title="Download" onClick={() => handleDownload(inv.id)}>
                                                    <FiDownload size={14} />
                                                  </button>
                                                  <button className="btn btn-sm btn-outline-danger" title="Delete" onClick={() => handleDelete(inv.id, inv.invoice_number)}>
                                                    <FiTrash2 size={14} />
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}