import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useDataStore } from '@/stores/dataStore'

export function MainLayout() {
  const { checkAndAutoGenerateReceipts } = useDataStore()

  useEffect(() => {
    checkAndAutoGenerateReceipts()
  }, [checkAndAutoGenerateReceipts])

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:pl-72">
        <div className="min-h-screen animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

