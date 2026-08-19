import { NotificationBell } from '@/components/shared/NotificationBell'
import { ChildSwitcher } from '@/components/layout/ChildSwitcher'
import { SeasonSwitcher } from '@/components/layout/SeasonSwitcher'

interface HeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/40"
      style={{ boxShadow: 'var(--shadow-header)' }}
    >
      <div className="flex min-h-[4.5rem] items-center justify-between gap-3 pl-14 pr-4 lg:pl-8 lg:pr-8 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl lg:text-2xl font-bold text-foreground truncate leading-tight tracking-tight font-jakarta">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs lg:text-[13px] text-muted-foreground hidden sm:block mt-0.5 font-medium opacity-80">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <ChildSwitcher />
          <SeasonSwitcher />
          {actions}
          <div className="h-6 w-px bg-border/60 mx-1 hidden sm:block" />
          <NotificationBell />
        </div>
      </div>
    </header>
  )
}
