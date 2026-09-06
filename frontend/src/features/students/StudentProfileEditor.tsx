import { useRef, useState, type FormEvent } from 'react'
import { ApiError, apiRequest } from '../../api'
import { CustomSelect, DatePicker, FieldError, ModalFrame, fieldErrorProps, focusFirstDialogError } from '../../components/AdminUi'
import type { LevelGroup, SchoolClassOption } from '../../components/ClassesPage'

type StudentProfile = {
  id: number
  student_no: string
  full_name: string
  level_group: LevelGroup
  class: { id: number; name: string } | null
  gender: string | null
  dob: string | null
  registration_date: string | null
  notes: string | null
}

export function StudentProfileEditor<T extends StudentProfile>({ student, schoolClasses, onSaved, onClose, onUnauthorized }: {
  student: T
  schoolClasses: SchoolClassOption[]
  onSaved: (student: T) => void
  onClose: () => void
  onUnauthorized: () => void
}) {
  const [initial] = useState(() => ({
    student_no: student.student_no, full_name: student.full_name, level_group: student.level_group,
    class_id: student.class ? String(student.class.id) : '', gender: student.gender ?? '',
    dob: student.dob ?? '', registration_date: student.registration_date ?? '', notes: student.notes ?? '',
  }))
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const firstInput = useRef<HTMLInputElement>(null)
  const changed = (Object.keys(initial) as Array<keyof typeof initial>).filter((field) => form[field] !== initial[field])
  const update = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }))
  const close = () => {
    if (savingRef.current) return
    if (changed.length && !window.confirm('Discard your unsaved student profile changes?')) return
    onClose()
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (savingRef.current || !changed.length) return
    savingRef.current = true
    setSaving(true)
    setErrors({})
    setError('')
    const body = Object.fromEntries(changed.map((field) => [field,
      field === 'class_id' ? (form[field] ? Number(form[field]) : null)
        : ['student_no', 'full_name', 'level_group'].includes(field) ? form[field] : form[field] || null,
    ]))
    try {
      const response = await apiRequest<{ student: T }>(`/students/${student.id}`, { method: 'PATCH', body })
      onSaved(response.student)
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        onUnauthorized()
      } else {
        setError(failure instanceof ApiError ? failure.message : 'Unable to save the student profile. Please try again.')
        if (failure instanceof ApiError && failure.status === 422) {
          setErrors(failure.errors ?? {})
          focusFirstDialogError()
        }
      }
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }
  const errorProps = (field: string) => fieldErrorProps(`edit-student-${field}-error`, errors[field]?.[0])
  const fieldError = (field: string) => <FieldError id={`edit-student-${field}-error`} message={errors[field]?.[0]} />
  const classOptions = schoolClasses.filter((item) => item.level_group === form.level_group)
    .map((item) => ({ value: String(item.id), label: item.name }))
  if (student.class && form.class_id === initial.class_id && !classOptions.some((item) => item.value === form.class_id)) {
    classOptions.push({ value: form.class_id, label: `${student.class.name} (current)` })
  }

  return (
    <ModalFrame title="Edit Student Profile" description={`${student.student_no} · ${student.full_name}`} size="standard" placement="drawer" initialFocusRef={firstInput} onClose={close}
      footer={<><button type="button" className="secondary-action" disabled={saving} onClick={close}>Cancel</button><button type="submit" form="edit-student-profile" className="primary-action compact" disabled={saving || !changed.length}>{saving ? 'Saving...' : 'Save Changes'}</button></>}>
      {error && <p role="alert" className="message-card error">{error}</p>}
      <form id="edit-student-profile" className="form-grid student-form" onSubmit={submit} aria-busy={saving}>
        <label className="form-field">Student ID<input ref={firstInput} aria-label="Student ID" value={form.student_no} maxLength={50} disabled={saving} onChange={(event) => update('student_no', event.target.value)} {...errorProps('student_no')} />{fieldError('student_no')}</label>
        <label className="form-field">Student Name<input aria-label="Student Name" value={form.full_name} maxLength={255} disabled={saving} onChange={(event) => update('full_name', event.target.value)} {...errorProps('full_name')} />{fieldError('full_name')}</label>
        <label className="form-field">Level Group<CustomSelect ariaLabel="Level Group" value={form.level_group} disabled={saving} onChange={(value) => setForm((current) => ({ ...current, level_group: value as LevelGroup, class_id: '' }))} options={[
          { value: 'kindergarten', label: 'Kindergarten' }, { value: 'primary', label: 'Primary' }, { value: 'secondary', label: 'Secondary' }, { value: 'stp', label: 'STP' },
        ]} {...errorProps('level_group')} />{fieldError('level_group')}</label>
        <label className="form-field">Class<CustomSelect ariaLabel="Class" value={form.class_id} disabled={saving} onChange={(value) => update('class_id', value)} options={[{ value: '', label: 'Not assigned' }, ...classOptions]} {...errorProps('class_id')} />{fieldError('class_id')}</label>
        {(changed.includes('class_id') || changed.includes('level_group')) && <p className="wide permission-note">This changes the profile class only. Academic-year enrolments must be updated separately in Classes.</p>}
        <label className="form-field">Gender<CustomSelect ariaLabel="Gender" value={form.gender} disabled={saving} onChange={(value) => update('gender', value)} options={[
          { value: '', label: 'Not recorded' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' },
          ...(!['', 'male', 'female'].includes(initial.gender) ? [{ value: initial.gender, label: initial.gender }] : []),
        ]} {...errorProps('gender')} />{fieldError('gender')}</label>
        <label className="form-field">Date of Birth<DatePicker ariaLabel="Date of Birth" value={form.dob} disabled={saving} onChange={(value) => update('dob', value)} placeholder="Not recorded" {...errorProps('dob')} />{fieldError('dob')}</label>
        <label className="form-field">Registration Date<DatePicker ariaLabel="Registration Date" value={form.registration_date} disabled={saving} onChange={(value) => update('registration_date', value)} placeholder="Not recorded" {...errorProps('registration_date')} />{fieldError('registration_date')}</label>
        <label className="form-field wide">Remarks<textarea aria-label="Remarks" value={form.notes} disabled={saving} onChange={(event) => update('notes', event.target.value)} {...errorProps('notes')} />{fieldError('notes')}</label>
      </form>
    </ModalFrame>
  )
}
