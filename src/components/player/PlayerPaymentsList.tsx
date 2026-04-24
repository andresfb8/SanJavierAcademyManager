import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePlayerPaymentsQuery, usePlayerInvoicesQuery } from '@/hooks/useQueries'
import { useDataStore } from '@/stores/dataStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Download, FileText, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { generateInvoicePDF } from '@/lib/invoice-pdf'
import { Skeleton } from '@/components/ui/skeleton'

interface PlayerPaymentsListProps {
  playerId: string
}

export function PlayerPaymentsList({ playerId }: PlayerPaymentsListProps) {
  const { club } = useDataStore()
  const { data: payments = [], isLoading: loadingPayments } = usePlayerPaymentsQuery(playerId)
  const { data: invoices = [], isLoading: loadingInvoices } = usePlayerInvoicesQuery(playerId)

  const isLoading = loadingPayments || loadingInvoices

  // Mapear facturas para acceso rápido por ID de pago
  const invoiceMap = useMemo(() => {
    const map = new Map<string, any>()
    invoices.forEach(inv => {
      inv.paymentIds?.forEach((pId: string) => {
        map.set(pId, inv)
      })
    })
    return map
  }, [invoices])

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/30 rounded-2xl border border-dashed">
        <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground/70">Sin pagos registrados</h3>
        <p className="text-sm text-muted-foreground max-w-[200px] mx-auto mt-1">
          Aún no tienes recibos o cuotas en tu historial.
        </p>
      </div>
    )
  }

  const handleDownloadInvoice = (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId)
    if (invoice && club) {
      generateInvoicePDF(invoice, club)
    }
  }

  return (
    <div className="space-y-4">
      {payments.map((payment) => {
        const invoice = payment.invoiceId ? invoices.find(inv => inv.id === payment.invoiceId) : invoiceMap.get(payment.id)
        const isPaid = payment.status === 'pagado'
        
        return (
          <Card key={payment.id} className="overflow-hidden border-none bg-background/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold truncate">{payment.concept}</span>
                    {isPaid ? (
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-none text-[10px] uppercase tracking-wider font-bold h-5">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Pagado
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-none text-[10px] uppercase tracking-wider font-bold h-5">
                        <Clock className="h-3 w-3 mr-1" />
                        Pendiente
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatDate(payment.createdAt)}</span>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                    <span className="font-medium text-foreground">{formatCurrency(payment.amount)}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {invoice ? (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-9 px-3 gap-2 border-primary/20 hover:border-primary/40 text-primary hover:bg-primary/5 rounded-xl transition-all"
                      onClick={() => handleDownloadInvoice(invoice.id)}
                    >
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">Factura</span>
                    </Button>
                  ) : isPaid ? (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground italic px-2">
                      <AlertCircle className="h-3 w-3" />
                      Factura en trámite
                    </div>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
