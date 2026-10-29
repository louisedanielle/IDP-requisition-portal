import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiChevronRight, FiChevronDown, FiEye, FiTrash2,
  FiDownload, FiFolder, FiCalendar, FiTag, FiUser,
} from 'react-icons/fi';
import {
  getFolderView,
  deleteRequisition,
  downloadMonthlyPRSummary,
  API_BASE_URL,
} from '../services/api';

function Requisitions() {
  const [tree, setTree] = useState({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState({});
  const [summaryMonth, setSummaryMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const navigate = useNavigate();

  const load = async () => {
    try {
      const data = await getFolderView();
      setTree(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const isOpen = (key, defaultOpen = true) => {
    if (defaultOpen === true && key.includes('::month::')) {
      return open[key] === true;  
    }
    return open[key] === undefined ? defaultOpen : open[key];
  };

  const toggle = (key) => setOpen((prev) => ({ ...prev, [key]: !isOpen(key) }));

  const handleDelete = async (id, prNumber) => {
    if (!window.confirm(`Delete ${prNumber}?`)) return;
    await deleteRequisition(id);
    load();
  };

  const handleDownload = (id) => {
    window.open(`${API_BASE_URL}/api/requisitions/${id}/export/word`, '_blank');
  };

  const handleDownloadSummary = () => {
    const [y, m] = summaryMonth.split('-');
    downloadMonthlyPRSummary(y, m);
  };

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header mb-4 d-flex justify-content-between align-items-center flex-wrap gap-3">
        <h1 className="page-title">Requisitions</h1>

        <div className="d-flex align-items-center gap-2">
          <input
            type="month"
            className="form-control"
            style={{ width: 180 }}
            value={summaryMonth}
            onChange={(e) => setSummaryMonth(e.target.value)}
          />
          <button
            className="btn btn-outline-primary d-flex align-items-center gap-2"
            onClick={handleDownloadSummary}
            title="Download monthly PR Summary Excel (one tab per PR)"
          >
            <FiDownload size={16} /> Download Summary
          </button>
        </div>
      </div>

      {Object.keys(tree).length === 0 && (
        <div className="pro-card">
          <div className="pro-card-body empty-state">
            <FiFolder className="empty-state-icon" />
            <h5>No requisitions yet</h5>
            <p>Upload a document or use Manual Input to get started</p>
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
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontWeight: 600,
                          padding: '8px 0',
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
                          {Object.entries(months).map(([month, categories]) => {
                            const mKey = `${yKey}::month::${month}`;
                            const mOpen = isOpen(mKey, false);
                            return (
                              <div key={mKey} style={{ marginBottom: 12 }}>
                                <div
                                  onClick={() => toggle(mKey)}
                                  style={{
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    fontWeight: 500,
                                    padding: '6px 0',
                                  }}
                                >
                                  {mOpen ? <FiChevronDown /> : <FiChevronRight />}
                                  <span>📅 {month === '—' ? 'No month' : month}</span>
                                </div>

                                {mOpen && (
                                  <div style={{ marginLeft: 16, marginTop: 6 }}>
                                    {Object.entries(categories).map(([category, payees]) => {
                                      const catKey = `${mKey}::cat::${category}`;
                                      const catOpen = isOpen(catKey, false);
                                      return (
                                        <div key={catKey} style={{ marginBottom: 12 }}>
                                          <div
                                            onClick={() => toggle(catKey)}
                                            style={{
                                              cursor: 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 6,
                                              fontSize: '0.8125rem',
                                              color: 'var(--primary)',
                                              textTransform: 'uppercase',
                                              fontWeight: 600,
                                              padding: '4px 0',
                                            }}
                                          >
                                            {catOpen ? <FiChevronDown size={14}/> : <FiChevronRight size={14}/>}
                                            <FiTag size={12} />
                                            {category}
                                            <span style={{ marginLeft: 6, textTransform: 'none', fontWeight: 400, color: 'var(--neutral-500)' }}>
                                              ({Object.keys(payees).length} payee{Object.keys(payees).length !== 1 ? 's' : ''})
                                            </span>
                                          </div>

                                          {catOpen && (
                                            <div style={{ marginLeft: 20, marginTop: 4 }}>
                                              {Object.entries(payees).map(([payee, prs]) => {
                                                const pKey = `${catKey}::payee::${payee}`;
                                                const pOpen = isOpen(pKey, true);
                                                return (
                                                  <div key={pKey} style={{ marginBottom: 10 }}>
                                                    <div
                                                      onClick={() => toggle(pKey)}
                                                      style={{
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                        fontSize: '0.8125rem',
                                                        fontWeight: 500,
                                                        padding: '4px 0',
                                                        color: 'var(--neutral-700)',
                                                      }}
                                                    >
                                                      {pOpen ? <FiChevronDown size={14}/> : <FiChevronRight size={14}/>}
                                                      <FiUser size={12} />
                                                      {payee}
                                                      <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--neutral-500)' }}>
                                                        ({prs.length})
                                                      </span>
                                                    </div>

                                                    {pOpen && (
                                                      <div style={{ marginLeft: 20, marginTop: 4 }}>
                                                        {prs.map((pr) => (
                                                          <div
                                                            key={pr.id}
                                                            style={{
                                                              display: 'flex',
                                                              alignItems: 'center',
                                                              gap: 12,
                                                              padding: '8px 12px',
                                                              border: '1px solid var(--neutral-200)',
                                                              borderRadius: 6,
                                                              marginBottom: 6,
                                                              background: 'white',
                                                            }}
                                                          >
                                                            <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                                                              {pr.pr_number}
                                                            </span>
                                                            <span style={{ color: 'var(--neutral-500)', fontSize: '0.8125rem' }}>
                                                              {pr.period || '—'}
                                                            </span>
                                                            <span style={{ color: 'var(--neutral-400)', fontSize: '0.75rem' }}>
                                                              {pr.item_count} item{pr.item_count !== 1 ? 's' : ''}
                                                            </span>
                                                            <span style={{ flex: 1 }} />
                                                            <span style={{ fontWeight: 600 }}>
                                                              HK${(pr.total_amount || 0).toLocaleString('en-US', {
                                                                minimumFractionDigits: 2,
                                                              })}
                                                            </span>
                                                            <span className={`status-badge status-${pr.status}`}>
                                                              {pr.status}
                                                            </span>
                                                            <button
                                                              className="btn btn-sm btn-outline-primary"
                                                              title="View"
                                                              onClick={() => navigate(`/requisitions/${pr.id}`)}
                                                            >
                                                              <FiEye size={14} />
                                                            </button>
                                                            <button
                                                              className="btn btn-sm btn-outline-primary"
                                                              title="Download Word"
                                                              onClick={() => handleDownload(pr.id)}
                                                            >
                                                              <FiDownload size={14} />
                                                            </button>
                                                            <button
                                                              className="btn btn-sm btn-outline-danger"
                                                              title="Delete"
                                                              onClick={() => handleDelete(pr.id, pr.pr_number)}
                                                            >
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
            )}
          </div>
        );
      })}
    </div>
  );
}

export default Requisitions;