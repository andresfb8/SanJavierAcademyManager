import { NotificationBell } from '@/components/shared/NotificationBell'

interface HeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 bg-background/95 backdrop-blur-md"
      style={{ boxShadow: 'var(--shadow-header)' }}
    >
      <div className="flex min-h-[4rem] items-center justify-between gap-3 pl-14 pr-4 lg:pl-6 lg:pr-6 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl lg:text-2xl font-bold text-foreground truncate leading-tight tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs lg:text-sm text-muted-foreground hidden sm:block mt-0.5 font-medium">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          <NotificationBell />
        </div>
      </div>
    </header>
  )
}
