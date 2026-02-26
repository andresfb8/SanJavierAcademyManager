import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useDataStore } from '@/stores/dataStore'
import {
  Users,
  Calendar,
  CreditCard,
  Settings,
  LogOut,
  LayoutDashboard,
  Wallet,
  Building2,
  FileText,
  Activity,
  ClipboardList,
  GraduationCap,
  BookOpen
} from 'lucide-react';

export function MainLayout() {
  const { checkAndAutoGenerateReceipts } = useDataStore()

  useEffect(() => {
    checkAndAutoGenerateReceipts()
  }, [checkAndAutoGenerateReceipts])

  const directorLinks = [
    { to: '/', icon: LayoutDashboard, label: 'Resumen' },
    { to: '/academy', icon: Building2, label: 'Mi Academia' },
    { to: '/methodology', icon: BookOpen, label: 'Metodología' },
    { to: '/finances', icon: Wallet, label: 'Gestión Económica' },
    { to: '/activity', icon: Activity, label: 'Registro de Actividad' },
    { to: '/settings', icon: Settings, label: 'Configuración' },
  ];

  const coordinatorLinks = [
    { to: '/', icon: LayoutDashboard, label: 'Resumen' },
    { to: '/academy', icon: Building2, label: 'Mi Academia' },
    { to: '/methodology', icon: BookOpen, label: 'Metodología' },
    { to: '/finances', icon: Wallet, label: 'Gestión Económica' },
    { to: '/settings', icon: Settings, label: 'Configuración' },
  ];

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
