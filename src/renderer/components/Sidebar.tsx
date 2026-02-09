import { Link, useLocation } from 'react-router-dom'
import { Home, Plus, Settings, BarChart3 } from 'lucide-react'
import { cn } from '../lib/utils'

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/meeting/new', icon: Plus, label: 'New Meeting' },
  { path: '/settings', icon: Settings, label: 'Settings' },
  { path: '/evaluations', icon: BarChart3, label: 'Evaluations' }
]

export function Sidebar() {
  const location = useLocation()

  return (
    <aside className="w-16 border-r border-border bg-card flex flex-col items-center py-4 gap-2">
      {/* Drag region for frameless window on macOS */}
      <div className="h-6 drag-region w-full" />

      {/* Navigation */}
      <nav className="flex flex-col gap-2 mt-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center transition-colors no-drag',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent text-muted-foreground hover:text-accent-foreground'
              )}
              title={item.label}
            >
              <item.icon className="w-5 h-5" />
            </Link>
          )
        })}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Version indicator */}
      <div className="text-xs text-muted-foreground">v0.1</div>
    </aside>
  )
}
