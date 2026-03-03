// ==========================================
// SearchableSelect Component
// ==========================================
// Select con búsqueda integrada tipo combobox

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Input } from '@/components/ui/input'
import { Check, ChevronDown } from 'lucide-react'

interface Option {
  value: string
  label: string
}

interface SearchableSelectProps {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'No se encontraron resultados',
  className = '',
  disabled = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [dropdownStyles, setDropdownStyles] = useState<React.CSSProperties>({})

  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Normalize text to ignore accents and case
  const normalizeText = (text: string) =>
    text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

  // Filter options based on search
  const filteredOptions = search.trim()
    ? options.filter((option) =>
      normalizeText(option.label).includes(normalizeText(search))
    )
    : options

  // Get selected option label
  const selectedOption = options.find((opt) => opt.value === value)
  const displayValue = selectedOption ? selectedOption.label : placeholder

  // Update dropdown position
  const updatePosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setDropdownStyles({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 99999,
      })
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      // Check if click is outside both the button container and the dropdown portal
      const clickedOutsideContainer = containerRef.current && !containerRef.current.contains(target)
      const clickedOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target)

      if (clickedOutsideContainer && clickedOutsideDropdown) {
        setIsOpen(false)
        setSearch('')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Manage positioning and event listeners while open
  useEffect(() => {
    if (isOpen) {
      updatePosition()
      window.addEventListener('resize', updatePosition)
      window.addEventListener('scroll', updatePosition, true)

      if (inputRef.current) {
        inputRef.current.focus()
      }

      return () => {
        window.removeEventListener('resize', updatePosition)
        window.removeEventListener('scroll', updatePosition, true)
      }
    }
  }, [isOpen])

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setIsOpen(false)
    setSearch('')
  }

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
      if (!isOpen) {
        setSearch('')
      }
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between
          rounded-md border border-input bg-background
          px-3 py-2 text-sm
          ring-offset-background
          focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
          disabled:cursor-not-allowed disabled:opacity-50
          ${!selectedOption ? 'text-muted-foreground' : ''}
        `}
      >
        <span className="truncate">{displayValue}</span>
        <ChevronDown className={`ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown via Portal */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyles}
          className="rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95"
        >
          {/* Search Input */}
          <div className="p-2 border-b">
            <Input
              ref={inputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8"
            />
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`
                    w-full flex items-center justify-between
                    rounded-sm px-2 py-1.5 text-sm
                    hover:bg-accent hover:text-accent-foreground
                    cursor-pointer
                    ${option.value === value ? 'bg-accent/50 text-accent-foreground' : 'text-foreground'}
                  `}
                >
                  <span className="truncate">{option.label}</span>
                  {option.value === value && (
                    <Check className="ml-2 h-4 w-4 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

