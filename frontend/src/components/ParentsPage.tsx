import React, { useState, useMemo, useEffect } from 'react'
import {
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Layers,
  Mail,
  MapPin,
  Phone,
  Search,
  Users,
} from 'lucide-react'
import { apiRequest } from '../api'
import {
  CustomSelect,
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
  const [expandedParents, setExpandedParents] = useState<Set<number>>(new Set([1, 2]))
  const [collapsedClasses, setCollapsedClasses] = useState<Set<string>>(new Set())

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

  // Extract all unique class names
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

  const toggleParentExpand = (parentId: number) => {
    setExpandedParents((prev) => {
      const next = new Set(prev)
      if (next.has(parentId)) {
        next.delete(parentId)
      } else {
        next.add(parentId)
      }
      return next
    })
  }

  const toggleClassCollapse = (className: string) => {
    setCollapsedClasses((prev) => {
      const next = new Set(prev)
      if (next.has(className)) {
        next.delete(className)
      } else {
        next.add(className)
      }
      return next
    })
  }

  const toggleExpandAllParents = () => {
    if (expandedParents.size > 0) {
      setExpandedParents(new Set())
    } else {
      setExpandedParents(new Set(filteredParents.map((p) => p.id)))
    }
  }

  const renderParentCard = (parent: ParentRecord, currentClassContext?: string) => {
    const isExpanded = expandedParents.has(parent.id)
    const parentClasses = Array.from(new Set(parent.children.map((c) => c.class_name)))
    const isMultiClassSibling = parentClasses.length > 1

    return (
      <article
        key={`${parent.id}-${currentClassContext ?? 'all'}`}
        className={`parent-accordion-card ${isExpanded ? 'is-expanded' : ''}`}
      >
        {/* Accordion Header / Trigger */}
        <div
          className="parent-accordion-header"
          onClick={() => toggleParentExpand(parent.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              toggleParentExpand(parent.id)
            }
          }}
          aria-expanded={isExpanded}
        >
          <div className="parent-avatar-badge">
            {parent.name.charAt(0)}
          </div>

          <div className="parent-header-main">
            <div className="parent-title-row">
              <h3 className="parent-name">{parent.name}</h3>
              {isMultiClassSibling && (
                <span className="parent-sibling-tag">
                  <Users size={12} />
                  <span>Sibling in Diff Classes</span>
                </span>
              )}
            </div>

            <div className="parent-meta-row">
              <span className="parent-meta-item">
                <Phone size={13} />
                <span>{parent.phone}</span>
              </span>
              <span className="parent-meta-item">
                <Mail size={13} />
                <span>{parent.email}</span>
              </span>
            </div>
          </div>

          <div className="parent-header-right">
            <div className="parent-classes-preview">
              {parentClasses.map((cls) => (
                <span
                  key={cls}
                  className={`parent-class-chip ${cls === currentClassContext ? 'active' : ''}`}
                >
                  {cls}
                </span>
              ))}
            </div>

            <span className="parent-children-count">
              <GraduationCap size={14} />
              <span>{parent.children.length} {parent.children.length === 1 ? 'Child' : 'Children'}</span>
            </span>

            <button
              type="button"
              className="parent-chevron-btn"
              aria-label={isExpanded ? 'Collapse parent details' : 'Expand parent details'}
            >
              <ChevronDown className={isExpanded ? 'expanded' : ''} size={16} />
            </button>
          </div>
        </div>

        {/* Accordion Expandable Body */}
        <div
          className={`parent-accordion-content${isExpanded ? ' expanded' : ''}`}
          aria-hidden={!isExpanded}
          inert={!isExpanded ? true : undefined}
        >
          <div className="parent-accordion-content-clip">
            <div className="parent-accordion-body">
            {parent.address && (
              <div className="parent-address-row">
                <MapPin size={14} className="parent-address-icon" />
                <span>{parent.address}</span>
              </div>
            )}

            <div className="parent-children-section">
              <span className="parent-section-title">
                Enrolled Children ({parent.children.length})
              </span>

              <div className="parent-children-grid">
                {parent.children.map((child) => (
                  <div key={child.student_no} className="parent-child-card">
                    <div className="parent-child-left">
                      <div className="parent-child-icon">
                        <GraduationCap size={15} />
                      </div>
                      <div>
                        <strong className="parent-child-name">{child.name}</strong>
                        <span className="parent-child-id">{child.student_no}</span>
                      </div>
                    </div>

                    <div className="parent-child-tags">
                      <span className="parent-tag class-tag">{child.class_name}</span>
                      <span className="parent-tag relation-tag">{child.relationship}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </div>
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
        description="View parent contact directory organized by class, with multi-class sibling badges and expandable family profiles."
      />

      <div
        className="stat-cards-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        <StatCard
          label="Total Parents"
          value={totalParents.toString()}
          meta="Registered parent contacts"
        />
        <StatCard
          label="Multi-Class Families"
          value={multiClassFamiliesCount.toString()}
          meta="Children across different classes"
        />
        <StatCard
          label="Active Classes"
          value={allClassNames.length.toString()}
          meta={allClassNames.join(', ')}
        />
      </div>

      <FilterToolbar ariaLabel="Parent Filter Toolbar">
        <div
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '280px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <input
                type="text"
                placeholder="Search parent name, email, phone, or child..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 12px 8px 34px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  background: '#ffffff',
                }}
              />
              <Search
                size={15}
                style={{
                  position: 'absolute',
                  left: '11px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  pointerEvents: 'none',
                }}
              />
            </div>

            <CustomSelect
              ariaLabel="Filter by class"
              value={selectedClass}
              onChange={(val) => setSelectedClass(String(val))}
              options={[
                { value: 'all', label: 'All Classes' },
                ...allClassNames.map((cls) => ({ value: cls, label: cls })),
              ]}
              size="compact"
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="secondary-button"
              onClick={toggleExpandAllParents}
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              {expandedParents.size > 0 ? 'Collapse All Cards' : 'Expand All Cards'}
            </button>

            <button
              type="button"
              className={groupByClassMode ? 'primary-button' : 'secondary-button'}
              onClick={() => setGroupByClassMode(!groupByClassMode)}
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              <Layers size={14} />
              <span>{groupByClassMode ? 'Organized By Class' : 'All Parents List'}</span>
            </button>
          </div>
        </div>
      </FilterToolbar>

      {groupByClassMode ? (
        // Group by Class View Mode
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {Array.from(parentsByClass.entries()).map(([className, classParents]) => {
            if (selectedClass !== 'all' && selectedClass !== className) return null
            if (classParents.length === 0) return null

            const isClassCollapsed = collapsedClasses.has(className)

            return (
              <DataPanel
                key={className}
                title={`Class: ${className}`}
                action={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                      {classParents.length} {classParents.length === 1 ? 'Parent' : 'Parents'}
                    </span>
                    <button
                      type="button"
                      className="secondary-action compact"
                      onClick={() => toggleClassCollapse(className)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      {isClassCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                      <span>{isClassCollapsed ? 'Expand' : 'Collapse'}</span>
                    </button>
                  </div>
                }
              >
                {!isClassCollapsed && (
                  <div className="parent-cards-container">
                    {classParents.map((parent) => renderParentCard(parent, className))}
                  </div>
                )}
              </DataPanel>
            )
          })}
        </div>
      ) : (
        // Flat List View Mode
        <DataPanel
          title="All Parent Contacts"
          action={
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
              Showing {filteredParents.length} {filteredParents.length === 1 ? 'parent' : 'parents'}
            </span>
          }
        >
          {filteredParents.length === 0 ? (
            <div className="empty-state compact">
              <strong>No matching parents found</strong>
              <p>Try adjusting your search query or class filter.</p>
            </div>
          ) : (
            <div className="parent-cards-container">
              {filteredParents.map((parent) => renderParentCard(parent))}
            </div>
          )}
        </DataPanel>
      )}
    </section>
  )
}
