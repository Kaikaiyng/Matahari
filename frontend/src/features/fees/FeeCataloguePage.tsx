import { Pencil, Plus } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, apiRequest } from '../../api'
import {
  CustomSelect,
  DataPanel,
  FieldError,
  InlineMessage,
  ModalFrame,
  PageHeader,
  StatusBadge,
  fieldErrorProps,
} from '../../components/AdminUi'
import './FeeCataloguePage.css'

type FeeItemStatus = 'active' | 'inactive'
type FeeItemCategory = 'mandatory' | 'optional'
type FeeItemType = 'recurring' | 'one_time'

type CatalogueFeeItem = {
  id: number
  code: string
  name: string
  category: FeeItemCategory
  fee_type: FeeItemType
  default_amount: number
  status: FeeItemStatus
}

type FeeItemForm = {
  name: string
  code: string
  category: FeeItemCategory
  fee_type: FeeItemType
  default_amount: string
  status: FeeItemStatus
}

const emptyForm: FeeItemForm = {
  name: '',
  code: '',
  category: 'optional',
  fee_type: 'recurring',
  default_amount: '0.00',
  status: 'active',
}

const categoryOptions = [
  { value: 'mandatory', label: 'Mandatory' },
  { value: 'optional', label: 'Optional' },
] satisfies Array<{ value: FeeItemCategory; label: string }>

const typeOptions = [
  { value: 'recurring', label: 'Recurring' },
  { value: 'one_time', label: 'One-time' },
] satisfies Array<{ value: FeeItemType; label: string }>

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] satisfies Array<{ value: FeeItemStatus; label: string }>

export function FeeCataloguePage({ canManage, schoolId, onUnauthorized }: {
  canManage: boolean
  schoolId: number | null
  onUnauthorized: () => void
}) {
  const [items, setItems] = useState<CatalogueFeeItem[]>([])
  const [editing, setEditing] = useState<CatalogueFeeItem | null | undefined>(undefined)
  const [form, setForm] = useState<FeeItemForm>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [message, setMessage] = useState('')
  const [loadError, setLoadError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const scopeQuery = schoolId ? `?school_id=${schoolId}` : ''
  const load = useCallback(async () => {
    if (!schoolId) {
      setItems([])
      setLoadError('A school must be selected before the Fee Catalogue can be loaded.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError('')
    try {
      const response = await apiRequest<{ data: CatalogueFeeItem[] }>(`/fee-items/catalogue${scopeQuery}`)
      setItems(response.data)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onUnauthorized()
      else setLoadError(error instanceof ApiError ? error.message : 'Unable to load the Fee Catalogue.')
    } finally {
      setIsLoading(false)
    }
  }, [onUnauthorized, schoolId, scopeQuery])

  useEffect(() => { void load() }, [load])

  const openCreate = () => {
    setForm(emptyForm)
    setErrors({})
    setEditing(null)
  }

  const openEdit = (item: CatalogueFeeItem) => {
    setForm({
      name: item.name,
      code: item.code,
      category: item.category,
      fee_type: item.fee_type,
      default_amount: item.default_amount.toFixed(2),
      status: item.status,
    })
    setErrors({})
    setEditing(item)
  }

  const close = () => {
    if (!isSaving) setEditing(undefined)
  }

  const submit = async () => {
    if (!schoolId) return
    setIsSaving(true)
    setErrors({})
    try {
      const path = editing ? `/fee-items/${editing.id}` : '/fee-items'
      const body = editing
        ? { name: form.name, category: form.category, fee_type: form.fee_type, default_amount: form.default_amount, status: form.status, school_id: schoolId }
        : { name: form.name, code: form.code, category: form.category, fee_type: form.fee_type, default_amount: form.default_amount, school_id: schoolId }
      await apiRequest(path, { method: editing ? 'PATCH' : 'POST', body })
      setMessage(editing ? 'Fee item updated.' : 'Fee item added.')
      setEditing(undefined)
      await load()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onUnauthorized()
      else if (error instanceof ApiError && error.errors) setErrors(error.errors)
      else setErrors({ form: [error instanceof ApiError ? error.message : 'Unable to save this fee item.'] })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="page-stack fee-catalogue-page">
      <PageHeader
        eyebrow="Finance"
        title="Fee Catalogue"
        description="Manage the standard fee items available when building student Fee Agreements."
        action={canManage && schoolId ? <button type="button" className="primary-action compact" onClick={openCreate}><Plus size={17}/>Add Fee Item</button> : undefined}
      />
      {message && <InlineMessage tone="success">{message}</InlineMessage>}
      {loadError && <InlineMessage tone="error">{loadError}</InlineMessage>}
      <DataPanel eyebrow="Fee structure" title="Standard Fee Items">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Item</th><th>Category</th><th>Billing Type</th><th>Default Amount</th><th>Status</th>{canManage && <th className="fee-catalogue-action-heading">Action</th>}</tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={canManage ? 6 : 5}>Loading fee items...</td></tr> : items.length === 0 ? <tr><td colSpan={canManage ? 6 : 5}>No fee items configured.</td></tr> : items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.name}</strong><small className="fee-item-code">{item.code}</small></td>
                  <td>{item.category === 'mandatory' ? 'Mandatory' : 'Optional'}</td>
                  <td>{item.fee_type === 'one_time' ? 'One-time' : 'Recurring'}</td>
                  <td>RM {item.default_amount.toFixed(2)}</td>
                  <td><StatusBadge tone={item.status === 'active' ? 'positive' : 'neutral'}>{item.status === 'active' ? 'Active' : 'Inactive'}</StatusBadge></td>
                  {canManage && <td className="fee-catalogue-action-cell"><button type="button" className="table-action" aria-label={`Edit ${item.name}`} onClick={() => openEdit(item)}><Pencil size={15}/>Edit</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataPanel>

      {editing !== undefined && <ModalFrame
        title={editing ? `Edit ${editing.name}` : 'Add Fee Item'}
        description={editing ? 'Update future catalogue use. Existing agreements and charges retain their snapshots.' : 'Create a standard item for future Fee Agreements.'}
        onClose={close}
        initialFocusRef={nameRef}
        footer={<><button type="button" className="secondary-action" disabled={isSaving} onClick={close}>Cancel</button><button type="button" className="primary-action" disabled={isSaving} onClick={() => void submit()}>{isSaving ? 'Saving...' : editing ? 'Save Changes' : 'Add Fee Item'}</button></>}
      >
        <div className="modal-form-grid fee-item-form-grid">
          {errors.form?.[0] && <div className="inline-error wide" role="alert">{errors.form[0]}</div>}
          <label>Item Name<input ref={nameRef} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} {...fieldErrorProps('fee-item-name-error', errors.name?.[0])}/><FieldError id="fee-item-name-error" message={errors.name?.[0]}/></label>
          <label>Code<input value={form.code} disabled={Boolean(editing)} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase().replace(/\s+/g, '_') }))} {...fieldErrorProps('fee-item-code-error', errors.code?.[0])}/><FieldError id="fee-item-code-error" message={errors.code?.[0]}/></label>
          <label>Category<CustomSelect ariaLabel="Fee item category" value={form.category} options={categoryOptions} disabled={Boolean(editing && ['TUITION', 'MISC'].includes(editing.code))} onChange={(category) => setForm((current) => ({ ...current, category }))}/></label>
          <label>Billing Type<CustomSelect ariaLabel="Fee item billing type" value={form.fee_type} options={typeOptions} disabled={Boolean(editing && ['TUITION', 'MISC'].includes(editing.code))} onChange={(fee_type) => setForm((current) => ({ ...current, fee_type }))}/></label>
          <label>Default Amount (RM)<input type="number" min="0" step="0.01" value={form.default_amount} onChange={(event) => setForm((current) => ({ ...current, default_amount: event.target.value }))} {...fieldErrorProps('fee-item-amount-error', errors.default_amount?.[0])}/><FieldError id="fee-item-amount-error" message={errors.default_amount?.[0]}/></label>
          {editing && <label>Status<CustomSelect ariaLabel="Fee item status" value={form.status} options={statusOptions} disabled={['TUITION', 'MISC'].includes(editing.code)} onChange={(status) => setForm((current) => ({ ...current, status }))}/><small className="field-help">{['TUITION', 'MISC'].includes(editing.code) ? 'Required foundation items must remain active, mandatory and recurring.' : 'Inactive items remain in history but cannot be added to new Fee Agreements.'}</small></label>}
        </div>
      </ModalFrame>}
    </section>
  )
}
