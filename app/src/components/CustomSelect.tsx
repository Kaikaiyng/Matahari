import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export type CustomSelectOption<T extends string | number = string> = {
  value: T
  label: string
  disabled?: boolean
}

export type CustomSelectProps<T extends string | number = string> = {
  value: T
  onChange: (value: T) => void
  options: Array<CustomSelectOption<T>>
  placeholder?: string
  ariaLabel?: string
  id?: string
  className?: string
  disabled?: boolean
  size?: 'compact' | 'standard'
}

export function CustomSelect<T extends string | number = string>({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  id,
  className = '',
  disabled = false,
  size = 'standard',
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedOption = options.find((opt) => opt.value === value)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('touchstart', handleClickOutside)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isOpen])

  return (
    <div
      ref={containerRef}
      className={`custom-select-container ${size} ${disabled ? 'disabled' : ''} ${className}`}
    >
      <select
        id={id}
        aria-label={ariaLabel}
        className="custom-select-native-peer"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        tabIndex={-1}
        style={{
          position: 'absolute',
          opacity: 0,
          pointerEvents: 'none',
          width: '1px',
          height: '1px',
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          border: 0,
        }}
      >
        {options.map((opt) => (
          <option key={String(opt.value)} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        className={`custom-select-trigger ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="custom-select-label">
          {selectedOption ? selectedOption.label : placeholder || 'Select option'}
        </span>
        <ChevronDown size={15} className={`custom-select-arrow ${isOpen ? 'is-open' : ''}`} />
      </button>

      {isOpen && (
        <div className="custom-select-dropdown" role="listbox" tabIndex={-1}>
          {options.map((opt) => {
            const isSelected = opt.value === value
            return (
              <button
                key={String(opt.value)}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={opt.disabled}
                className={`custom-select-option ${isSelected ? 'is-selected' : ''}`}
                onClick={() => {
                  onChange(opt.value)
                  setIsOpen(false)
                }}
              >
                <span className="custom-select-option-label">{opt.label}</span>
                {isSelected && <Check size={14} className="custom-select-check" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
