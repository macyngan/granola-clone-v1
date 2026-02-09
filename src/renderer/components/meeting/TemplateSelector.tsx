import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { defaultTemplates } from '@shared/config/templates'
import { cn } from '../../lib/utils'

interface TemplateSelectorProps {
  value: string
  onChange: (templateId: string) => void
}

export function TemplateSelector({ value, onChange }: TemplateSelectorProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selectedTemplate = defaultTemplates.find((t) => t.id === value) || defaultTemplates[0]

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative no-drag" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-accent hover:bg-accent/80 rounded-lg transition-colors"
      >
        <span>{selectedTemplate.icon}</span>
        <span>{selectedTemplate.name}</span>
        <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-popover border border-border rounded-lg shadow-lg z-50 py-1">
          {defaultTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => {
                onChange(template.id)
                setOpen(false)
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent transition-colors',
                template.id === value && 'bg-accent'
              )}
            >
              <span className="text-lg">{template.icon}</span>
              <div className="flex-1 text-left">
                <div className="font-medium">{template.name}</div>
                <div className="text-xs text-muted-foreground">{template.description}</div>
              </div>
              {template.id === value && <Check className="w-4 h-4 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
