import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useDataStore } from '@/stores/dataStore'
import { cn } from '@/lib/utils'

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

export function MainLayout() {
  const { checkAndAutoGenerateReceipts } = useDataStore()

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    checkAndAutoGenerateReceipts()
  }, [checkAndAutoGenerateReceipts])

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed))
    } catch {
      // localStorage no disponible (modo privado, etc.) — el estado sigue funcionando en memoria
    }
  }, [sidebarCollapsed])

  return (
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      <Sidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((prev) => !prev)} />
      <main className={cn('transition-[padding] duration-200', sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-72')}>
        <div className="min-h-screen animate-fade-in p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
