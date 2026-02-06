import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function MainLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:pl-64">
        <div className="min-h-screen">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
