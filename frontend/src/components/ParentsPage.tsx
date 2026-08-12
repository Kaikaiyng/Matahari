import React, { useState, useMemo, useEffect } from 'react'
import {
  IconlyPhone,
  IconlyMail,
  IconlyUsers,
  IconlyLayers,
  IconlyGraduationCap,
} from './icons/IconlyIcons'
import { apiRequest } from '../api'
import {
  DataPanel,
  FilterToolbar,
  PageHeader,
  StatCard,
} from './AdminUi'

export interface ParentChild {
  id: number
  student_no: string
  name: string
  class_name: string
  relationship: string
}

export interface ParentRecord {
  id: number
  name: string
  phone: string
  email: string
  address: string
  children: ParentChild[]
}

const DEMO_PARENTS: ParentRecord[] = [
  {
    id: 1,
    name: 'Rachel Wong',
    phone: '+60 12-888 7777',
    email: 'rachel.wong@example.com',
    address: '12 Jalan Ampang, Kuala Lumpur',
    children: [
      { id: 1, student_no: 'MIS-2026-001', name: 'Alyssa Tan', class_name: 'MB1', relationship: 'Mother' },
      { id: 2, student_no: 'MIS-2026-002', name: 'Daniel Lim', class_name: 'MC1', relationship: 'Mother' },
    ],
  },
  {
    id: 2,
    name: 'Michelle Tan',
    phone: '+60 12-345 6789',
    email: 'michelle.tan@example.com',
    address: '88 Persiaran KLCC, Kuala Lumpur',
    children: [
      { id: 3, student_no: 'MIS-2026-003', name: 'Mika Tan', class_name: 'MA1', relationship: 'Mother' },
      { id: 4, student_no: 'MIS-2026-004', name: 'Noor Aisyah', class_name: 'MB1', relationship: 'Guardian' },
    ],
  },
  {
    id: 3,
    name: 'Jonathan Lim',
    phone: '+60 12-222 4411',
    email: 'jonathan.lim@example.com',
    address: '45 Mont Kiara Drive, Kuala Lumpur',
    children: [
      { id: 2, student_no: 'MIS-2026-002', name: 'Daniel Lim', class_name: 'MC1', relationship: 'Father' },
    ],
  },
  {
    id: 4,
    name: 'Siti Rahmah',
    phone: '+60 12-100 0004',
    email: 'siti.rahmah@example.com',
    address: '5 Taman Tun Dr Ismail, Kuala Lumpur',
    children: [
      { id: 4, student_no: 'MIS-2026-004', name: 'Noor Aisyah', class_name: 'MB1', relationship: 'Mother' },
    ],
  },
]

export const ParentsPage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [selectedClass, setSelectedClass] = useState('all')
  const [groupByClassMode, setGroupByClassMode] = useState(true)
  const [systemClasses, setSystemClasses] = useState<string[]>([])

  useEffect(() => {
    async function loadClasses() {
      try {
        const resp = await apiRequest<{ data: Array<{ id: number; name: string }> }>('/classes')
        if (resp?.data && resp.data.length > 0) {
          const names = resp.data.map((c) => c.name)
          setSystemClasses(names)
        }
      } catch {
        // Soft fallback
      }
    }
    void loadClasses()
  }, [])

  // Extract all unique class names (combining configured system classes and parent data classes)
  const allClassNames = useMemo(() => {
    const set = new Set<string>(systemClasses)
    DEMO_PARENTS.forEach((p) => {
      p.children.forEach((c) => set.add(c.class_name))
    })
    return Array.from(set).sort()
  }, [systemClasses])

  // Filter parents by search query and class filter
  const filteredParents = useMemo(() => {
    return DEMO_PARENTS.filter((parent) => {
      const parentMatch =
        parent.name.toLowerCase().includes(search.toLowerCase()) ||
        parent.phone.includes(search) ||
        parent.email.toLowerCase().includes(search.toLowerCase())
      const childMatch = parent.children.some(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.student_no.toLowerCase().includes(search.toLowerCase())
      )
      const matchesSearch = parentMatch || childMatch

      const matchesClass =
        selectedClass === 'all' ||
        parent.children.some((c) => c.class_name === selectedClass)

      return matchesSearch && matchesClass
    })
  }, [search, selectedClass])

  // Group parents by class for the "Group by Class" view mode
  const parentsByClass = useMemo(() => {
    const map = new Map<string, ParentRecord[]>()
    allClassNames.forEach((cls) => map.set(cls, []))

    filteredParents.forEach((parent) => {
      // Find all unique classes this parent's children belong to
      const parentClasses = Array.from(new Set(parent.children.map((c) => c.class_name)))
      parentClasses.forEach((clsName) => {
        if (map.has(clsName)) {
          map.get(clsName)!.push(parent)
        }
      })
    })

    return map
  }, [filteredParents, allClassNames])

  const totalParents = DEMO_PARENTS.length
  const multiClassFamiliesCount = DEMO_PARENTS.filter((p) => {
    const classes = new Set(p.children.map((c) => c.class_name))
    return classes.size > 1
  }).length

  const renderParentCard = (parent: ParentRecord, currentClassContext?: string) => {
    const parentClasses = Array.from(new Set(parent.children.map((c) => c.class_name)))
    const isMultiClassSibling = parentClasses.length > 1

    return (
      <article
        key={`${parent.id}-${currentClassContext ?? 'all'}`}
        className="data-panel"
        style={{ padding: '16px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'var(--brand-primary-soft, #fff1f2)',
              color: 'var(--brand-primary, #e11d48)',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
              fontSize: '15px'
            }}>
              {parent.name.charAt(0)}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{parent.name}</h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>{parent.address}</span>
            </div>
          </div>

          {isMultiClassSibling && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: '#fef3c7',
              color: '#92400e',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700
            }}>
              <IconlyUsers size={14} /> Sibling in Diff Classes
            </span>
          )}
        </div>

        {/* Contact details */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: '#475569', marginBottom: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <IconlyPhone size={15} color="#64748b" /> {parent.phone}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <IconlyMail size={15} color="#64748b" /> {parent.email}
          </span>
        </div>

        {/* Display Classes Badges (shows BOTH classes if siblings are in different classes) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Classes:</span>
          {parentClasses.map((cls) => (
            <span
              key={cls}
              style={{
                background: cls === currentClassContext ? 'var(--brand-primary, #e11d48)' : '#f1f5f9',
                color: cls === currentClassContext ? '#ffffff' : '#334155',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                border: cls === currentClassContext ? 'none' : '1px solid #cbd5e1'
              }}
            >
              {cls}
            </span>
          ))}
        </div>

        {/* Linked Children List */}
        <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>
            Linked Children ({parent.children.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {parent.children.map((child) => (
              <div key={child.student_no} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                <span style={{ fontWeight: 600, color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <IconlyGraduationCap size={16} color="var(--brand-primary, #e11d48)" />
                  <span>{child.name}</span>
                  <span style={{ color: '#94a3b8', fontSize: '11px' }}>({child.student_no})</span>
                </span>
                <span style={{ color: '#475569', fontSize: '11px', background: '#ffffff', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                  {child.class_name} • {child.relationship}
                </span>
              </div>
            ))}
          </div>
        </div>
      </article>
    )
  }

  return (
    <section className="page-stack parents-page">
      <PageHeader
        eyebrow="School Directory"
        title="Parent & Guardian Directory"
        description="View parent contact directory organized by class, with multi-class sibling badges."
      />

      <div className="stat-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <StatCard label="Total Parents" value={totalParents.toString()} meta="Registered parent contacts" />
        <StatCard label="Multi-Class Families" value={multiClassFamiliesCount.toString()} meta="Children across different classes" />
        <StatCard label="Active Classes" value={allClassNames.length.toString()} meta={allClassNames.join(', ')} />
      </div>

      <FilterToolbar ariaLabel="Parent Filter Toolbar">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search parent name, email, phone, or child..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', flex: 1, minWidth: '200px' }}
          />
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
          >
            <option value="all">All Classes</option>
            {allClassNames.map((cls) => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>

          <button
            type="button"
            className={groupByClassMode ? 'primary-button' : 'secondary-button'}
            onClick={() => setGroupByClassMode(!groupByClassMode)}
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            <IconlyLayers size={15} />
            {groupByClassMode ? 'Organized By Class' : 'All Parents List'}
          </button>
        </div>
      </FilterToolbar>

      {groupByClassMode ? (
        // Group by Class View Mode
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {Array.from(parentsByClass.entries()).map(([className, classParents]) => {
            if (selectedClass !== 'all' && selectedClass !== className) return null
            if (classParents.length === 0) return null

            return (
              <DataPanel key={className} title={`Class: ${className}`}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                  {classParents.map((parent) => renderParentCard(parent, className))}
                </div>
              </DataPanel>
            )
          })}
        </div>
      ) : (
        // Flat List View Mode
        <DataPanel title="All Parent Contacts">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {filteredParents.map((parent) => renderParentCard(parent))}
          </div>
        </DataPanel>
      )}
    </section>
  )
}
