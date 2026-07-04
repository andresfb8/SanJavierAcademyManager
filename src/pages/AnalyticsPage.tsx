import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TrendingUp, AlertTriangle, Star, Trophy } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { KPIsTab } from '@/components/shared/analytics/KPIsTab'
import { RiskTab } from '@/components/shared/analytics/RiskTab'
import { ReviewsTab } from '@/components/shared/analytics/ReviewsTab'
import { CoachRankingTab } from '@/components/shared/analytics/CoachRankingTab'
import { useClassReviewsQuery } from '@/hooks/useQueries'

type Tab = 'kpis' | 'riesgo' | 'cuestionarios' | 'ranking'

const VALID_TABS: Tab[] = ['kpis', 'riesgo', 'cuestionarios', 'ranking']

export default function AnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as Tab | null
  const [activeTab, setActiveTab] = useState<Tab>(
    tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'kpis'
  )

  const { data: classReviews = [] } = useClassReviewsQuery()

  useEffect(() => {
    if (tabParam && VALID_TABS.includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  const handleTabChange = (value: string) => {
    setActiveTab(value as Tab)
    setSearchParams({ tab: value }, { replace: true })
  }

  return (
    <div>
      <Header
        title="Inteligencia del Club"
        subtitle="Análisis accionable de rendimiento, retención y calidad"
      />

      <div className="p-5 lg:p-6">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1 mb-6">
            <TabsTrigger value="kpis" className="flex items-center gap-1.5 text-xs py-2">
              <TrendingUp className="h-3.5 w-3.5 hidden sm:block" />
              KPIs del Club
            </TabsTrigger>
            <TabsTrigger value="riesgo" className="flex items-center gap-1.5 text-xs py-2">
              <AlertTriangle className="h-3.5 w-3.5 hidden sm:block" />
              Riesgo de baja
            </TabsTrigger>
            <TabsTrigger value="cuestionarios" className="flex items-center gap-1.5 text-xs py-2">
              <Star className="h-3.5 w-3.5 hidden sm:block" />
              Cuestionarios
            </TabsTrigger>
            <TabsTrigger value="ranking" className="flex items-center gap-1.5 text-xs py-2">
              <Trophy className="h-3.5 w-3.5 hidden sm:block" />
              Ranking coaches
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kpis">
            <KPIsTab />
          </TabsContent>

          <TabsContent value="riesgo">
            <RiskTab />
          </TabsContent>

          <TabsContent value="cuestionarios">
            <ReviewsTab classReviews={classReviews} />
          </TabsContent>

          <TabsContent value="ranking">
            <CoachRankingTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
