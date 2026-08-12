import React, { useEffect, useState, useCallback } from 'react'
import './ParentPortalView.css'
import {
  portalApi,
  type PortalChild,
  type OutstandingCharge,
  type PortalPayment,
  type PortalReceipt,
} from '../api/portalApi'
import {
  IconlyFees,
  IconlyCheck,
  IconlyPhone,
  IconlyMail,
  IconlyUsers,
} from './icons/IconlyIcons'

export interface ParentPortalViewProps {
  parentName: string
  activeTab: string
}

const ACADEMIC_YEAR = new Date().getFullYear().toString()

function formatMYR(amount: number): string {
  return `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="portal-skeleton-wrap">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="portal-skeleton-row" style={{ width: i === 0 ? '80%' : '60%' }} />
      ))}
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="portal-error-state">
      <span>⚠️</span>
      <p>{message}</p>
      <button onClick={onRetry} className="portal-retry-btn">Retry</button>
    </div>
  )
}

// ─── Finance Tab ──────────────────────────────────────────────────────────────
function FinanceTab({ childrenList }: { childrenList: PortalChild[] }) {
  const [selectedChild, setSelectedChild] = useState<PortalChild | null>(childrenList[0] ?? null)
  const [outstanding, setOutstanding] = useState<OutstandingCharge[]>([])
  const [payments, setPayments] = useState<PortalPayment[]>([])
  const [receipts, setReceipts] = useState<PortalReceipt[]>([])
  const [selectedReceipt, setSelectedReceipt] = useState<PortalReceipt | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Payment Drawer Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'fpx' | 'card' | 'ewallet'>('fpx')
  const [selectedBank, setSelectedBank] = useState('Maybank2u')
  const [paying, setPaying] = useState(false)
  const [paySuccessMsg, setPaySuccessMsg] = useState<string | null>(null)

  const loadData = useCallback(async (child: PortalChild) => {
    if (!child.can_view_finance) return
    try {
      setLoading(true)
      setError(null)
      const [outResp, payResp, recResp] = await Promise.all([
        portalApi.getChildOutstanding(child.id, ACADEMIC_YEAR),
        portalApi.getChildPayments(child.id),
        portalApi.getChildReceipts(child.id),
      ])
      setOutstanding(outResp.data)
      setPayments(payResp.data)
      setReceipts(recResp.data)
    } catch {
      setError('Unable to load finance data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedChild) void loadData(selectedChild)
  }, [selectedChild, loadData])

  const totalOutstanding = outstanding.reduce((sum, c) => sum + c.outstanding_amount, 0)
  const financeChildren = childrenList.filter((c) => c.can_view_finance)

  // Demo-only preview. No payment endpoint is called and no financial record is created.
  const handleConfirmPayment = () => {
    setPaying(true)
    setTimeout(() => {
      setPaying(false)
      setIsPayModalOpen(false)

      setPaySuccessMsg('Demo preview only: no payment or payment notice was submitted or saved.')

      setTimeout(() => setPaySuccessMsg(null), 10000)
    }, 1000)
  }

  return (
    <div className="parent-portal-view">
      <h2 className="portal-section-title">Finance & Billing</h2>

      {paySuccessMsg && (
        <div style={{
          background: '#dcfce7',
          color: '#15803d',
          padding: '14px 16px',
          borderRadius: '14px',
          fontSize: '13px',
          fontWeight: 700,
          border: '1px solid #bbf7d0',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <IconlyCheck size={18} color="#15803d" />
          <span>{paySuccessMsg}</span>
        </div>
      )}

      {financeChildren.length > 1 && (
        <div className="portal-child-selector">
          {financeChildren.map((c) => (
            <button
              key={c.id}
              className={`portal-child-pill ${selectedChild?.id === c.id ? 'active' : ''}`}
              onClick={() => setSelectedChild(c)}
            >
              {c.full_name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {!selectedChild?.can_view_finance && (
        <div className="portal-info-card">
          <span>🔒</span>
          <p>Finance access is not enabled for this child.</p>
        </div>
      )}

      {selectedChild?.can_view_finance && loading && <LoadingSkeleton lines={4} />}
      {selectedChild?.can_view_finance && error && (
        <ErrorState message={error} onRetry={() => selectedChild && void loadData(selectedChild)} />
      )}

      {selectedChild?.can_view_finance && !loading && !error && (
        <>
          <div className="portal-balance-card">
            <div className="portal-balance-header">
              <span>Outstanding Balance — {selectedChild.full_name}</span>
              {totalOutstanding > 0 && (
                <span className="portal-balance-badge-danger">Action Required</span>
              )}
            </div>
            <div className="portal-balance-amount">{formatMYR(totalOutstanding)}</div>
            {totalOutstanding === 0 ? (
              <div style={{ fontSize: '13px', color: '#16a34a', marginTop: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <IconlyCheck size={16} color="#16a34a" /> All fees are fully settled
              </div>
            ) : (
              <button
                type="button"
                className="portal-pay-now-btn"
                onClick={() => setIsPayModalOpen(true)}
                style={{
                  marginTop: '14px',
                  width: '100%',
                  background: 'var(--brand-primary, #e11d48)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(225, 29, 72, 0.25)'
                }}
              >
                <IconlyFees size={18} color="#fff" />
                <span>Preview Payment Notice ({formatMYR(totalOutstanding)})</span>
              </button>
            )}
          </div>

          {outstanding.filter((c) => c.outstanding_amount > 0).length > 0 && (
            <>
              <h3 className="portal-section-title">Outstanding Charges</h3>
              {outstanding
                .filter((c) => c.outstanding_amount > 0)
                .map((charge) => (
                  <div key={charge.id} className="child-card">
                    <div>
                      <div className="child-name">{charge.description}</div>
                      <div className="child-class">{charge.billing_month} • {charge.fee_code}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: '#dc2626', fontSize: '13px' }}>
                      {formatMYR(charge.outstanding_amount)}
                    </div>
                  </div>
                ))}
            </>
          )}

          <h3 className="portal-section-title">Payment Submissions & History</h3>
          {payments.length === 0 ? (
            <div className="portal-empty-state">No payment records found.</div>
          ) : (
            payments.map((payment) => (
              <div key={payment.id} className="child-card">
                <div>
                  <div className="child-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{payment.issued_receipt?.receipt_no ?? `Payment Submission (${payment.payment_date})`}</span>
                    {payment.status === 'pending' && (
                      <span style={{ fontSize: '10px', background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        ⏳ Pending Verification
                      </span>
                    )}
                  </div>
                  <div className="child-class">
                    {payment.payment_date} • {payment.payment_method ?? '—'}
                    {payment.paid_by ? ` • by ${payment.paid_by}` : ''}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: payment.status === 'pending' ? '#d97706' : '#16a34a', fontSize: '13px' }}>
                  {formatMYR(payment.amount)}
                </div>
              </div>
            ))
          )}

          <h3 className="portal-section-title">Receipts</h3>
          {receipts.length === 0 ? (
            <div className="portal-empty-state">No receipts found.</div>
          ) : (
            receipts.map((receipt) => (
              <div
                key={receipt.id}
                className="child-card child-card-clickable"
                onClick={() => setSelectedReceipt(receipt)}
              >
                <div>
                  <div className="child-name">{receipt.receipt_no}</div>
                  <div className="child-class">{receipt.receipt_date} • {receipt.payment_method ?? '—'}</div>
                </div>
                <div style={{ fontWeight: 700, color: '#16a34a', fontSize: '13px' }}>
                  {formatMYR(receipt.amount)} ›
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* Pay Now Drawer Modal */}
      {isPayModalOpen && (
        <div className="portal-modal-overlay" onClick={() => setIsPayModalOpen(false)}>
          <div className="portal-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="portal-modal-header">
              <h3>Payment Notice Preview — {selectedChild?.full_name}</h3>
              <button onClick={() => setIsPayModalOpen(false)} className="portal-modal-close">✕</button>
            </div>

            <div style={{ padding: '16px 0' }}>
              <div className="portal-demo-notice">
                Demo only. Confirming this preview will not create a payment, upload proof, or change the balance.
              </div>
              <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Total Amount Due</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{formatMYR(totalOutstanding)}</div>
              </div>

              <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '10px' }}>Select Payment Method:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px',
                  borderRadius: '10px', border: paymentMethod === 'fpx' ? '2px solid var(--brand-primary, #e11d48)' : '1px solid #cbd5e1',
                  background: paymentMethod === 'fpx' ? '#fff1f2' : '#fff', cursor: 'pointer'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 600 }}>
                    <input type="radio" name="payMethod" checked={paymentMethod === 'fpx'} onChange={() => setPaymentMethod('fpx')} />
                    <span>🏦 FPX Online Banking</span>
                  </div>
                  {paymentMethod === 'fpx' && (
                    <select
                      value={selectedBank}
                      onChange={(e) => setSelectedBank(e.target.value)}
                      style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '12px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="Maybank2u">Maybank2u</option>
                      <option value="CIMB Clicks">CIMB Clicks</option>
                      <option value="Public Bank">Public Bank</option>
                      <option value="RHB Online">RHB Online</option>
                    </select>
                  )}
                </label>

                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px',
                  borderRadius: '10px', border: paymentMethod === 'card' ? '2px solid var(--brand-primary, #e11d48)' : '1px solid #cbd5e1',
                  background: paymentMethod === 'card' ? '#fff1f2' : '#fff', cursor: 'pointer'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 600 }}>
                    <input type="radio" name="payMethod" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} />
                    <span>💳 Credit / Debit Card (Visa / Mastercard)</span>
                  </div>
                </label>

                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px',
                  borderRadius: '10px', border: paymentMethod === 'ewallet' ? '2px solid var(--brand-primary, #e11d48)' : '1px solid #cbd5e1',
                  background: paymentMethod === 'ewallet' ? '#fff1f2' : '#fff', cursor: 'pointer'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 600 }}>
                    <input type="radio" name="payMethod" checked={paymentMethod === 'ewallet'} onChange={() => setPaymentMethod('ewallet')} />
                    <span>📱 Touch 'n Go / GrabPay eWallet</span>
                  </div>
                </label>
              </div>

              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={paying}
                style={{
                  width: '100%',
                  background: 'var(--brand-primary, #e11d48)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '14px',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: paying ? 'not-allowed' : 'pointer',
                  opacity: paying ? 0.7 : 1
                }}
              >
                {paying ? 'Preparing Preview...' : `Confirm Demo Preview (${formatMYR(totalOutstanding)})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt detail modal */}
      {selectedReceipt && (
        <div className="portal-modal-overlay" onClick={() => setSelectedReceipt(null)}>
          <div className="portal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="portal-modal-header">
              <h3>{selectedReceipt.receipt_no}</h3>
              <button onClick={() => setSelectedReceipt(null)} className="portal-modal-close">✕</button>
            </div>
            <div className="portal-modal-meta">
              <span>{selectedReceipt.receipt_date}</span>
              <span>{selectedReceipt.payment_method ?? '—'}</span>
              {selectedReceipt.paid_by && <span>Paid by: {selectedReceipt.paid_by}</span>}
            </div>
            <div className="portal-modal-items">
              {selectedReceipt.items.map((item, i) => (
                <div key={i} className="portal-modal-item">
                  <div>
                    <div className="child-name" style={{ fontSize: '13px' }}>{item.description}</div>
                    <div className="child-class">{item.fee_code}</div>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>{formatMYR(item.amount)}</div>
                </div>
              ))}
            </div>
            <div className="portal-modal-total">
              Total: <strong>{formatMYR(selectedReceipt.amount)}</strong>
            </div>
            <div className="portal-modal-status" style={{ color: selectedReceipt.status === 'void' ? '#dc2626' : '#16a34a' }}>
              Status: {selectedReceipt.status.toUpperCase()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Children Tab ──────────────────────────────────────────────────────────────
function ChildrenTab({ childrenList }: { childrenList: PortalChild[] }) {
  return (
    <div className="parent-portal-view">
      <h2 className="portal-section-title">My Children</h2>
      {childrenList.length === 0 ? (
        <div className="portal-empty-state">No linked children found.</div>
      ) : (
        <div className="child-cards-container">
          {childrenList.map((child) => (
            <div key={child.id} className="child-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="child-info">
                  <div className="child-avatar-icon" style={{ background: 'var(--brand-primary-soft, #fff1f2)', color: 'var(--brand-primary, #e11d48)' }}>
                    {child.full_name.charAt(0)}
                  </div>
                  <div>
                    <div className="child-name" style={{ fontSize: '15px' }}>{child.full_name}</div>
                    <div className="child-class">
                      {child.class?.name ?? 'No class'} • {child.student_no}
                    </div>
                    <div className="portal-access-flags" style={{ marginTop: '4px' }}>
                      {child.can_view_finance && <span className="portal-access-tag">💳 Finance</span>}
                      {child.can_view_academics && <span className="portal-access-tag">📚 Academics</span>}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    background: child.status === 'active' ? '#dcfce7' : '#f1f5f9',
                    color: child.status === 'active' ? '#15803d' : '#64748b',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontWeight: 700,
                  }}
                >
                  {child.status.toUpperCase()}
                </span>
              </div>

              {/* Demo-only attendance and feedback until an approved attendance module exists. */}
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                <div className="portal-demo-label">Demo academic preview</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                  <span style={{ color: '#475569' }}>Attendance Rate</span>
                  <span style={{ color: '#16a34a' }}>98.5% (Excellent)</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
                  <div style={{ width: '98.5%', height: '100%', background: '#16a34a', borderRadius: '4px' }} />
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                  💬 "Showing excellent enthusiasm and active participation in class activities."
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const ParentPortalView: React.FC<ParentPortalViewProps> = ({ parentName, activeTab }) => {
  const [guardianData, setGuardianData] = useState<{ full_name: string } | null>(null)
  const [children, setChildren] = useState<PortalChild[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const resp = await portalApi.getGuardianMe()
      setGuardianData(resp.data)
      setChildren(resp.children)
    } catch {
      setError('Unable to load guardian profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (activeTab === 'finance') {
    if (loading) return <div className="parent-portal-view"><LoadingSkeleton lines={5} /></div>
    if (error) return <div className="parent-portal-view"><ErrorState message={error} onRetry={load} /></div>
    return <FinanceTab childrenList={children} />
  }

  if (activeTab === 'children') {
    if (loading) return <div className="parent-portal-view"><LoadingSkeleton lines={4} /></div>
    if (error) return <div className="parent-portal-view"><ErrorState message={error} onRetry={load} /></div>
    return <ChildrenTab childrenList={children} />
  }

  if (activeTab === 'profile') {
    const displayName = loading ? parentName : (guardianData?.full_name ?? parentName)
    return (
      <div className="parent-portal-view">
        {/* Profile hero */}
        <div className="portal-welcome-card" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', zIndex: 1 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 18,
              background: 'linear-gradient(135deg, #818cf8, #a78bfa)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 800, color: '#fff',
            }}>
              {displayName.charAt(0)}
            </div>
            <div>
              <div className="portal-welcome-title">{displayName}</div>
              <div className="portal-welcome-sub">Parent / Guardian Portal Account</div>
            </div>
          </div>
        </div>

        <div className="child-card" style={{ flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Account Information</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#475569' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconlyPhone size={16} color="#64748b" /> +60 12-888 7777
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconlyMail size={16} color="#64748b" /> rachel.wong@example.com
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconlyUsers size={16} color="#64748b" /> {children.length} Linked Children
            </span>
          </div>
        </div>
      </div>
    )
  }

  // Home Dashboard
  const displayName = loading ? parentName : (guardianData?.full_name ?? parentName)
  return (
    <div className="parent-portal-view">
      <div className="portal-welcome-card">
        <div className="portal-welcome-title">Welcome back, {displayName}!</div>
        <div className="portal-welcome-sub">MIS Parent & Guardian Mobile Portal</div>
      </div>

      <h2 className="portal-section-title">My Children</h2>
      {loading && <LoadingSkeleton lines={3} />}
      {!loading && children.length === 0 && (
        <div className="portal-empty-state">No children linked to your account.</div>
      )}
      {!loading && children.length > 0 && (
        <div className="child-cards-container">
          {children.map((child) => (
            <div key={child.id} className="child-card">
              <div className="child-info">
                <div className="child-avatar-icon">{child.full_name.charAt(0)}</div>
                <div>
                  <div className="child-name">{child.full_name}</div>
                  <div className="child-class">{child.class?.name ?? 'No class'} • {child.student_no}</div>
                </div>
              </div>
              <span className="child-status-badge">{child.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
