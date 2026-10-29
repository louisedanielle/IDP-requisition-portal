import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiFolder, FiTag, FiDownload, FiDollarSign,
} from 'react-icons/fi';
import {
  getDashboardStats,
  getIncomeStats,
  downloadCompanyAnnualReport,
  downloadAllCompaniesAnnualReport,
  downloadMonthlyReport,
  downloadMonthlyPRSummary,
} from '../services/api';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [incomeStats, setIncomeStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prSummaryMonth, setPrSummaryMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    const currentYear = new Date().getFullYear().toString();
    Promise.all([getDashboardStats(), getIncomeStats(currentYear)])
      .then(([statsData, incStats]) => {
        setStats(statsData);
        setIncomeStats(incStats);
      })
      .catch((err) => console.error('Dashboard load error:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner-border text-primary" role="status" />
        <div className="mt-3">Loading dashboard...</div>
      </div>
    );
  }

  const lastMonth = stats?.last_month || { label: '', count: 0, total: 0 };
  const thisMonth = stats?.this_month || { label: '', count: 0, total: 0 };
  const thisYear = stats?.this_year || { label: '', count: 0, total: 0 };
  const byCompany = stats?.by_company_this_year || {};

  const totalIncomeRm = incomeStats?.total_rm || 0;
  const totalIncomeHkd = incomeStats?.total_hkd || 0;
  const totalIncomeUsd = incomeStats?.total_usd || 0;
  const incomeByCompany = incomeStats?.by_company || {};

  const fmt = (n) =>
    Number(n || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const handleDownloadPrSummary = () => {
    const [y, m] = prSummaryMonth.split('-');
    downloadMonthlyPRSummary(y, m);
  };

  return (
    <div>
      {/* ---------- Header ---------- */}
      <div className="page-header mb-4 d-flex justify-content-between align-items-start flex-wrap gap-3">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of payment requisitions &amp; revenue</p>
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap">
          <input
            type="month"
            className="form-control form-control-sm"
            style={{ width: 160 }}
            value={prSummaryMonth}
            onChange={(e) => setPrSummaryMonth(e.target.value)}
            title="Month for PR Summary export"
          />
          <button
            className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
            onClick={handleDownloadPrSummary}
            title="Download PR Summary Excel (one tab per PR)"
          >
            <FiDownload size={14} /> PR Summary
          </button>
          <button
            className="btn btn-sm btn-outline-success d-flex align-items-center gap-1"
            onClick={() => downloadMonthlyReport(thisYear.label)}
            title="Download Income vs Expenses Report"
          >
            <FiDownload size={14} /> Monthly Report
          </button>
        </div>
      </div>

      {/* ---------- Stat cards ---------- */}
      <div className="row g-3 mb-4">
        <div className="col-lg-4 col-md-6">
          <div className="stat-card h-100">
            <div className="stat-label">Amount Paid · Last Month · {lastMonth.label}</div>
            <div className="stat-value success">HK${fmt(lastMonth.total)}</div>
          </div>
        </div>

        <div className="col-lg-4 col-md-6">
          <div className="stat-card h-100">
            <div className="stat-label">Requisitions · Current Month · {thisMonth.label}</div>
            <div className="stat-value primary">{thisMonth.count}</div>
          </div>
        </div>

        <div className="col-lg-4 col-md-6">
          <div className="stat-card h-100">
            <div className="stat-label">Amount Paid · Current Month · {thisMonth.label}</div>
            <div className="stat-value success">HK${fmt(thisMonth.total)}</div>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* INCOME SECTION                                                   */}
      {/* ================================================================ */}
      {incomeStats && (
        <div className="mb-5">
          <div className="d-flex align-items-center mb-3" style={{ gap: 8 }}>
            <FiDollarSign style={{ color: 'var(--success)' }} size={18} />
            <h5 style={{ margin: 0, fontWeight: 600, flex: 1 }}>
              Income by Company · {thisYear.label}
            </h5>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-lg-4 col-md-6">
              <div className="stat-card h-100" style={{ borderLeft: '4px solid var(--success)' }}>
                <div className="stat-label">Total Income (RM)</div>
                <div className="stat-value success">RM {fmt(totalIncomeRm)}</div>
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="stat-card h-100" style={{ borderLeft: '4px solid var(--success)' }}>
                <div className="stat-label">Total Income (HKD)</div>
                <div className="stat-value success">HK${fmt(totalIncomeHkd)}</div>
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="stat-card h-100" style={{ borderLeft: '4px solid var(--success)' }}>
                <div className="stat-label">Total Income (USD)</div>
                <div className="stat-value success">US${fmt(totalIncomeUsd)}</div>
              </div>
            </div>
          </div>

          {Object.entries(incomeByCompany).map(([company, data]) => (
            <div key={`inc-${company}`} className="pro-card mb-3" style={{ overflow: 'hidden' }}>
              <div
                style={{
                  padding: '16px 20px',
                  background: 'var(--success)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <FiDollarSign size={18} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '1rem' }}>{company}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: 2 }}>
                    {data.invoices} invoice{data.invoices !== 1 ? 's' : ''}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    lineHeight: 1.2,
                  }}
                >
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                    RM {fmt(data.total_rm)}
                  </div>
                  {data.total_hkd > 0 && (
                    <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>
                      HK${fmt(data.total_hkd)}
                    </div>
                  )}
                  {data.total_usd > 0 && (
                    <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>
                      US${fmt(data.total_usd)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {Object.keys(incomeByCompany).length === 0 && (
            <div className="pro-card">
              <div className="pro-card-body text-center py-4" style={{ color: 'var(--neutral-500)' }}>
                No income recorded for {thisYear.label} yet.
                <Link to="/income" className="ms-2">Upload a revenue report</Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* EXPENSES / REQUISITIONS SECTION                                  */}
      {/* ================================================================ */}
      {Object.keys(byCompany).length > 0 && (
        <>
          <div className="d-flex align-items-center mb-3 mt-4" style={{ gap: 8 }}>
            <FiTag style={{ color: 'var(--neutral-400)' }} size={16} />
            <h5 style={{ margin: 0, fontWeight: 600, flex: 1 }}>
              Expenses by Company &amp; Category · {thisYear.label}
            </h5>
            <button
              className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
              onClick={() => downloadAllCompaniesAnnualReport(thisYear.label)}
              title="Download all companies annual report"
            >
              <FiDownload size={14} /> All Companies Report
            </button>
          </div>

          {Object.entries(byCompany).map(([company, data]) => (
            <div
              key={company}
              className="pro-card mb-3"
              style={{ overflow: 'hidden' }}
            >
              {/* Company header */}
              <div
                style={{
                  padding: '16px 20px',
                  background: 'var(--primary)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <FiFolder size={18} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '1rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {company}
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: 2 }}>
                    {data.count} requisition{data.count !== 1 ? 's' : ''} ·{' '}
                    {Object.keys(data.categories).length} categor
                    {Object.keys(data.categories).length !== 1 ? 'ies' : 'y'}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  HK${fmt(data.total)}
                </div>
                {data.company_id && (
                  <button
                    className="btn btn-sm d-flex align-items-center gap-1"
                    onClick={() => downloadCompanyAnnualReport(data.company_id, thisYear.label)}
                    title={`Download ${company} annual report`}
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      color: 'white',
                      border: '1px solid rgba(255,255,255,0.35)',
                      fontSize: '0.75rem',
                    }}
                  >
                    <FiDownload size={13} /> Annual
                  </button>
                )}
              </div>

              {/* Categories list */}
              <div style={{ padding: '8px 0' }}>
                {Object.entries(data.categories).map(([cat, catData], idx, arr) => {
                  const pct = data.total > 0 ? (catData.total / data.total) * 100 : 0;
                  const isLast = idx === arr.length - 1;

                  return (
                    <div
                      key={cat}
                      style={{
                        padding: '12px 20px',
                        borderBottom: isLast ? 'none' : '1px solid var(--neutral-100)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontWeight: 500,
                          color: 'var(--neutral-800)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={cat}
                      >
                        {cat}
                      </div>

                      <div
                        style={{
                          width: 60,
                          textAlign: 'right',
                          fontSize: '0.8125rem',
                          color: 'var(--neutral-500)',
                        }}
                      >
                        {catData.count}{' '}
                        <span style={{ fontSize: '0.7rem' }}>
                          PR{catData.count !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div
                        style={{ width: 100, display: 'flex', alignItems: 'center', gap: 8 }}
                        title={`${pct.toFixed(1)}% of company total`}
                      >
                        <div
                          style={{
                            flex: 1,
                            height: 6,
                            background: 'var(--neutral-100)',
                            borderRadius: 3,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                              height: '100%',
                              background: 'var(--primary)',
                              borderRadius: 3,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color: 'var(--neutral-500)',
                            width: 32,
                            textAlign: 'right',
                          }}
                        >
                          {pct.toFixed(0)}%
                        </span>
                      </div>

                      <div
                        style={{
                          width: 120,
                          textAlign: 'right',
                          fontWeight: 600,
                          color: 'var(--neutral-800)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {fmt(catData.total)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Empty state for expenses */}
      {Object.keys(byCompany).length === 0 && (
        <div className="pro-card">
          <div className="pro-card-body empty-state">
            <FiTag className="empty-state-icon" />
            <h5>No expenses yet · {thisYear.label}</h5>
            <p>Upload a document or use Manual Input to create a requisition</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;