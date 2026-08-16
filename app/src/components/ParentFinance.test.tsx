import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { portalApi, type PortalReceipt } from '../api/portalApi'
import { ParentPortalView } from './ParentPortalView'

const children = [
  { id: 1, student_no: 'MIS-001', full_name: 'Alyssa Tan', status: 'active', class: { id: 1, name: 'MB1' }, academic_year: { id: 1, code: '2026', name: '2026' }, can_view_finance: true, can_view_academics: true },
  { id: 2, student_no: 'MIS-002', full_name: 'Daniel Tan', status: 'active', class: { id: 2, name: 'MB2' }, academic_year: { id: 1, code: '2026', name: '2026' }, can_view_finance: true, can_view_academics: true },
]

function receipt(id: number, receiptNo: string): PortalReceipt {
  return { id, receipt_no: receiptNo, receipt_date: '2026-08-10', student_no: `MIS-00${id}`, student_name: id === 1 ? 'Alyssa Tan' : 'Daniel Tan', amount: id * 100, amount_in_words: 'One Hundred Ringgit Only', paid_by: 'Rachel Wong', payment_method: 'bank_transfer', payment_date: '2026-08-10', received_date: '2026-08-10', status: 'issued', issued_at: '2026-08-10T10:00:00Z', voided_at: null, void_reason: null, items: [{ fee_code: 'TUITION', description: 'Tuition fee', amount: id * 100 }] }
}

describe('parent finance', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(portalApi, 'getGuardianMe').mockResolvedValue({ data: { id: 1, full_name: 'Rachel Wong', phone: null, email: null }, children })
    vi.spyOn(portalApi, 'getChildOutstanding').mockImplementation(async (studentId) => ({ data: [{ id: studentId, fee_code: 'TUITION', description: 'Tuition fee', billing_month: '2026-08', expected_amount: studentId * 100, paid_amount: 0, outstanding_amount: studentId * 100, billing_status: 'billable', collection_status: 'unpaid' }] }))
    vi.spyOn(portalApi, 'getChildPayments').mockImplementation(async (studentId) => ({ data: [{ id: studentId, payment_date: '2026-08-10', amount: studentId * 100, paid_by: 'Rachel Wong', payment_method: 'bank_transfer', status: 'verified', issued_receipt: { id: studentId, receipt_no: `MIS.A000${studentId}`, receipt_date: '2026-08-10', status: 'issued' } }] }))
    vi.spyOn(portalApi, 'getChildReceipts').mockImplementation(async (studentId) => ({ data: [receipt(studentId, `MIS.A000${studentId}`)] }))
    vi.spyOn(portalApi, 'getChildReceipt').mockImplementation(async (studentId, receiptId) => ({ data: receipt(studentId, `MIS.A000${receiptId}`) }))
  })

  it('switches finance records using child cards', async () => {
    render(<ParentPortalView parentName="Rachel Wong" activeTab="finance" onTabChange={vi.fn()} onLogout={vi.fn()} />)

    expect((await screen.findAllByText('RM 100.00')).length).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole('button', { name: 'View Daniel Tan finance' }))

    expect((await screen.findAllByText('RM 200.00')).length).toBeGreaterThan(0)
    expect(portalApi.getChildOutstanding).toHaveBeenLastCalledWith(2, '2026')
  })

  it('opens the selected child receipt and supports browser PDF printing', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    render(<ParentPortalView parentName="Rachel Wong" activeTab="finance" onTabChange={vi.fn()} onLogout={vi.fn()} />)

    await userEvent.click(await screen.findByRole('button', { name: 'View receipt MIS.A0001' }))
    const dialog = await screen.findByRole('dialog', { name: 'Receipt MIS.A0001' })
    expect(within(dialog).getByText('Tuition fee')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Print or save receipt as PDF' }))

    await waitFor(() => expect(print).toHaveBeenCalledOnce())
    expect(portalApi.getChildReceipt).toHaveBeenCalledWith(1, 1)
  })
})
