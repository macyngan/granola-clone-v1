import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'

export default function App() {
  const navigate = useNavigate()

  useEffect(() => {
    // Listen for navigation events from main process (menu, tray)
    const cleanup = window.electron.onNavigate((path) => {
      navigate(path)
    })

    return cleanup
  }, [navigate])

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
