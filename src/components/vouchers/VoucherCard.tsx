import { Voucher } from '@/types'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Ticket, CalendarClock, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'

interface VoucherCardProps {
  voucher: Voucher
  onClick?: () => void
}

export function VoucherCard({ voucher, onClick }: VoucherCardProps) {
  const getStatusColor = () => {
    switch (voucher.status) {
      case 'active': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'exhausted': return 'bg-slate-100 text-slate-700 border-slate-200'
      case 'expired': return 'bg-red-100 text-red-700 border-red-200'
      case 'pending_payment': return 'bg-amber-100 text-amber-700 border-amber-200'
      default: return 'bg-slate-100 text-slate-700'
    }
  }

  const getStatusLabel = () => {
    switch (voucher.status) {
      case 'active': return 'Activo'
      case 'exhausted': return 'Agotado'
      case 'expired': return 'Caducado'
      case 'pending_payment': return 'Pendiente de Pago'
      default: return voucher.status
    }
  }

  const getVoucherTitle = () => {
    switch (voucher.type) {
      case '1_class': return 'Clase Suelta'
      case '5_classes': return 'Bono 5 Clases'
      case '10_classes': return 'Bono 10 Clases'
      case 'monthly': return 'Bono Mensual'
      default: return 'Bono'
    }
  }

  const progress = voucher.totalClasses > 0
    ? Math.min(100, (voucher.usedClasses / voucher.totalClasses) * 100)
    : 100

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-200",
        "border-none shadow-md hover:shadow-lg rounded-[1.5rem]",
        onClick ? "cursor-pointer active:scale-[0.98]" : "",
        voucher.status === 'exhausted' || voucher.status === 'expired' ? "opacity-75 grayscale-[0.5]" : ""
      )}
      onClick={onClick}
    >
      {/* Decorative side accent */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-2",
        voucher.status === 'active' ? "bg-emerald-400" :
          voucher.status === 'pending_payment' ? "bg-amber-400" :
            voucher.status === 'expired' ? "bg-red-400" : "bg-slate-300"
      )} />

      <CardHeader className="pb-2 pt-5 px-5 flex flex-row items-start justify-between">
        <div className="pl-3">
          <Badge variant="outline" className={cn("mb-2 border-none font-bold uppercase tracking-widest text-[9px]", getStatusColor())}>
            {getStatusLabel()}
          </Badge>
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Ticket className="h-5 w-5 text-primary/70" />
            {getVoucherTitle()}
          </h3>
        </div>
        <div className="text-right">
          <span className="text-xl font-black text-slate-800">{voucher.price}€</span>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5 pl-8">
        <div className="space-y-4">

          {/* Progress Section */}
          {voucher.type !== 'monthly' && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span>{voucher.usedClasses} usadas</span>
                <span>{voucher.totalClasses - voucher.usedClasses} restantes</span>
              </div>
              <Progress
                value={progress}
                className={cn(
                  "h-2",
                  progress >= 100 ? "[&>div]:bg-slate-400" :
                    progress >= 80 ? "[&>div]:bg-amber-400" :
                      "[&>div]:bg-emerald-500"
                )}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 font-medium pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" />
              <span>Creado: {formatDate(voucher.createdAt).split(' ')[0]}</span>
            </div>
            {voucher.expiresAt && (
              <div className="flex items-center gap-1">
                {voucher.status === 'expired' ? (
                  <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                )}
                <span className={voucher.status === 'expired' ? "text-red-500" : ""}>
                  Caduca: {formatDate(voucher.expiresAt).split(' ')[0]}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
