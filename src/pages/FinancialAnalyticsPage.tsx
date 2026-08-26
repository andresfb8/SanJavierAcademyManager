import { Header } from '@/components/layout/Header'
import { FinanceTab } from '@/components/shared/analytics/FinanceTab'

export default function FinancialAnalyticsPage() {
  return (
    <div>
      <Header
        title="Análisis Financiero"
        subtitle="Ingresos, márgenes, estructura de costes y cobro del club"
      />

      <div className="p-5 lg:p-6">
        <FinanceTab />
      </div>
    </div>
  )
}
