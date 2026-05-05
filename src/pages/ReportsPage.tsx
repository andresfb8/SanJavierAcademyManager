import { useState, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useDataStore } from '@/stores/dataStore'
import {
  FileText,
  Download,
  TrendingUp,
  TrendingDown,
  Users,
  Euro,
  AlertCircle,
  BarChart3,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useAttendanceQuery, useActivitiesQuery } from '@/hooks/useQueries'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'
import { calculateEventSalary } from '@/lib/salary-utils'
import { normalizeAllPayments } from '@/lib/payment-utils'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'

// ==========================================
// ReportsPage - Informes mensuales en PDF
// ==========================================

const MONTHS = [
  { value: '1', label: 'Enero' },
  { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' },
  { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
]

const currentYear = new Date().getFullYear()
const YEARS = [currentYear - 1, currentYear, currentYear + 1].map((y) => ({
  value: String(y),
  label: String(y),
}))

function getDefaultMonth() {
  const d = new Date()
  // Default: previous month
  const m = d.getMonth() === 0 ? 12 : d.getMonth()
  const y = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear()
  return { month: String(m), year: String(y) }
}

export default function ReportsPage() {
  const defaults = getDefaultMonth()
  const [selectedMonth, setSelectedMonth] = useState(defaults.month)
  const [selectedYear, setSelectedYear] = useState(defaults.year)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false)
  const [detailsView, setDetailsView] = useState<'altas_bajas' | 'morosos' | 'grupos' | 'ingresos_eventos' | null>(null)

  const { 
    players, 
    groups, 
    coaches, 
    enrollments, 
    events, 
    coachSalaryConfigs, 
    privateLessons, 
    club,
    payments: allBasePayments,
    eventPayments,
    privateLessonPayments,
    clubTransactions: allTransactions
  } = useDataStore()

  const year = parseInt(selectedYear)
  const month = parseInt(selectedMonth)
  const monthLabel = MONTHS.find((m) => m.value === selectedMonth)?.label ?? selectedMonth

  // Consultas (Store en tiempo real)
  // =====================================
  // DATA NORMALIZATION (Shared with Dashboard/Payments)
  // =====================================
  const allPayments = useMemo(
    () => normalizeAllPayments(allBasePayments, eventPayments, privateLessonPayments ?? [], events),
    [allBasePayments, eventPayments, privateLessonPayments, events]
  )

  const currentMonthAllPayments = useMemo(
    () => allPayments.filter(p => p.billingMonth === month && p.billingYear === year),
    [allPayments, month, year]
  )

  const transactions = useMemo(() => {
    return allTransactions.filter(t => {
      const d = t.date instanceof Date ? t.date : new Date(t.date)
      return d.getFullYear() === year && d.getMonth() + 1 === month
    })
  }, [allTransactions, year, month])

  // =====================================
  // COMPUTED DATA FOR PREVIEW
  // =====================================

  // -- Altas del mes --
  const altasDelMes = useMemo(
    () =>
      players.filter((p) => {
        const d = p.registrationDate instanceof Date ? p.registrationDate : new Date(p.registrationDate)
        return d.getMonth() + 1 === month && d.getFullYear() === year
      }),
    [players, month, year]
  )

  // -- Bajas del mes --
  const bajasDelMes = useMemo(
    () =>
      players.filter((p) => {
        if (!p.cancellationDate) return false
        const d = p.cancellationDate instanceof Date ? p.cancellationDate : new Date(p.cancellationDate)
        return d.getMonth() + 1 === month && d.getFullYear() === year
      }),
    [players, month, year]
  )

  // -- Ingresos por tipo (Sincronizado con Dashboard) --
  const ingresosCuotas = useMemo(
    () => currentMonthAllPayments
      .filter((p) => p.status === 'pagado' && (p.source === 'cuota' || p.source === 'manual'))
      .reduce((s: number, p: any) => s + Number(p.amount || 0), 0),
    [currentMonthAllPayments]
  )

  const ingresosEventos = useMemo(
    () => currentMonthAllPayments
      .filter((p) => p.status === 'pagado' && p.source === 'evento')
      .reduce((s: number, p: any) => s + Number(p.amount || 0), 0),
    [currentMonthAllPayments]
  )

  const ingresosClases = useMemo(
    () => currentMonthAllPayments
      .filter((p) => p.status === 'pagado' && p.source === 'clase_particular')
      .reduce((s: number, p: any) => s + Number(p.amount || 0), 0),
    [currentMonthAllPayments]
  )

  // -- Gastos de eventos del mes (Sigue vinculado a la fecha del evento) --
  const eventosDelMes = useMemo(
    () =>
      events.filter((ev) => {
        const d = ev.date instanceof Date ? ev.date : new Date(ev.date)
        return d.getMonth() + 1 === month && d.getFullYear() === year
      }),
    [events, month, year]
  )

  const gastosEventos = useMemo(
    () =>
      eventosDelMes.reduce(
        (acc: number, ev: any) => acc + (ev.expenses ?? []).reduce((s: number, ex: any) => s + Number(ex.amount || 0), 0),
        0
      ),
    [eventosDelMes]
  )

  // -- Clases particulares del mes (para nóminas) --
  const clasesDelMes = useMemo(
    () =>
      privateLessons.filter((pl) => {
        const d = pl.date instanceof Date ? pl.date : new Date(pl.date)
        return d.getMonth() + 1 === month && d.getFullYear() === year
      }),
    [privateLessons, month, year]
  )

  // -- Transacciones manuales del mes --
  const extrasIngresos = useMemo(() => transactions.filter(t => t.type === 'ingreso').reduce((sum, t) => sum + Number(t.amount || 0), 0), [transactions])
  const extrasGastos = useMemo(() => transactions.filter(t => t.type === 'gasto').reduce((sum, t) => sum + Number(t.amount || 0), 0), [transactions])

  const totalIngresos = ingresosCuotas + ingresosEventos + ingresosClases + extrasIngresos
  const totalGastos = gastosEventos + extrasGastos
  const beneficioNetoTotal = totalIngresos - totalGastos

  // -- Morosidad (pagos pendientes de este mes) --
  const morosos = useMemo(() => {
    return currentMonthAllPayments.filter((p) => p.status === 'pendiente')
  }, [currentMonthAllPayments])

  const totalMorosidad = morosos.reduce((s: number, p: any) => s + Number(p.amount || 0), 0)

  // -- Grupos con más cambios del mes --
  const groupChanges = useMemo(() => {
    const changeMap: Record<string, { name: string; altas: number; bajas: number; coachName: string }> = {}
    for (const g of groups) {
      const coach = coaches.find(c => c.id === g.coachId)
      const coachName = coach ? `${coach.firstName} ${coach.lastName}` : 'Sin monitor'
      changeMap[g.id] = { name: g.name, altas: 0, bajas: 0, coachName }
    }
    for (const e of enrollments) {
      const enrDate = e.enrollmentDate instanceof Date ? e.enrollmentDate : new Date(e.enrollmentDate)
      if (enrDate.getMonth() + 1 === month && enrDate.getFullYear() === year && changeMap[e.groupId]) {
        changeMap[e.groupId].altas++
      }
      if (e.unenrollmentDate) {
        const unenDate =
          e.unenrollmentDate instanceof Date ? e.unenrollmentDate : new Date(e.unenrollmentDate)
        if (
          unenDate.getMonth() + 1 === month &&
          unenDate.getFullYear() === year &&
          changeMap[e.groupId]
        ) {
          changeMap[e.groupId].bajas++
        }
      }
    }
    return Object.values(changeMap)
      .filter((g) => g.altas + g.bajas > 0)
      .sort((a, b) => b.altas + b.bajas - (a.altas + a.bajas))
  }, [groups, enrollments, month, year])

  // -- Nóminas estimadas del mes --
  const nominasEstimadas = useMemo(() => {
    return coaches
      .filter((c) => c.isActive)
      .map((coach) => {
        const config = coachSalaryConfigs.find((c) => c.coachId === coach.id)
        if (!config) return { coach, total: 0, grupos: 0, clases: 0, eventosTotal: 0, bonuses: 0 }

        const coachGroups = groups.filter((g) => g.coachId === coach.id)
        const adultGroups = coachGroups.filter((g) => g.level !== 'menores').length
        const minorGroups = coachGroups.filter((g) => g.level === 'menores').length
        const grupos = adultGroups * (config.ratePerGroupAdults || 0) + minorGroups * (config.ratePerGroupMinors || 0)

        const monthLessons = clasesDelMes.filter((pl) => pl.coachId === coach.id)
        const clases = monthLessons.reduce((acc: number, lesson: any) => {
          if (config.privateLessonPaymentType === 'fixed') return acc + (config.privateLessonRate || 0)
          return acc + lesson.price * ((config.privateLessonRate || 0) / 100)
        }, 0)

        const eventosTotal = eventosDelMes.reduce((acc: number, ev: any) => {
          if (!ev.coachIds.includes(coach.id)) return acc
          return acc + calculateEventSalary(ev, eventPayments, config)
        }, 0)

        const bonuses = config.bonuses || 0
        return { coach, total: grupos + clases + eventosTotal + bonuses, grupos, clases, eventosTotal, bonuses }
      })
      .filter((n) => n.total > 0 || coachSalaryConfigs.find((c) => c.coachId === n.coach.id))
  }, [coaches, coachSalaryConfigs, groups, clasesDelMes, eventosDelMes, eventPayments])

  // =====================================
  // PDF GENERATION
  // =====================================

  const generatePDF = () => {
    setIsGenerating(true)
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const margin = 15
      let y = margin

      // ---- Helper functions ----
      const addTitle = (text: string) => {
        doc.setFillColor(30, 41, 59) // slate-800
        doc.rect(margin, y, pageW - margin * 2, 9, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text(text, margin + 3, y + 6.5)
        doc.setTextColor(30, 41, 59)
        y += 13
      }

      const checkPage = (neededHeight = 40) => {
        if (y + neededHeight > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage()
          y = margin
        }
      }

      const fmt = (n: number) =>
        n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })

      // ========== PORTADA ==========
      doc.setFillColor(30, 41, 59)
      doc.rect(0, 0, pageW, 50, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text('INFORME MENSUAL', pageW / 2, 22, { align: 'center' })
      doc.setFontSize(14)
      doc.setFont('helvetica', 'normal')
      doc.text(`${monthLabel} ${year}`, pageW / 2, 33, { align: 'center' })
      doc.setFontSize(9)
      doc.text(club?.name ?? 'San Javier Academy', pageW / 2, 42, { align: 'center' })
      doc.setTextColor(30, 41, 59)
      y = 60

      // ========== 1. RESUMEN ECONÓMICO ==========
      addTitle('1. RESUMEN ECONÓMICO')

      autoTable(doc, {
        startY: y,
        head: [['Concepto', 'Importe']],
        body: [
          ['Ingresos por cuotas', fmt(ingresosCuotas)],
          ['Ingresos por eventos', fmt(ingresosEventos)],
          ['Ingresos por clases particulares', fmt(ingresosClases)],
          ['Otros ingresos', fmt(extrasIngresos)],
          ['TOTAL INGRESOS', fmt(totalIngresos)],
          ['Gastos de eventos', fmt(-gastosEventos)],
          ['Gastos de explotación y nóminas', fmt(-extrasGastos)],
          ['BENEFICIO NETO', fmt(beneficioNetoTotal)],
        ],
        headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        didParseCell: (data) => {
          if (data.row.index === 4 || data.row.index === 7) {
            data.cell.styles.fontStyle = 'bold'
            if (data.row.index === 7) {
              data.cell.styles.fillColor = beneficioNetoTotal >= 0 ? [220, 252, 231] : [254, 226, 226]
              data.cell.styles.textColor = beneficioNetoTotal >= 0 ? [21, 128, 61] : [185, 28, 28]
            } else {
              data.cell.styles.fillColor = [241, 245, 249]
            }
          }
          if (data.row.index === 5 && data.column.index === 1) {
            data.cell.styles.textColor = [185, 28, 28]
          }
          if (data.row.index === 6 && data.column.index === 1) {
            data.cell.styles.textColor = [185, 28, 28]
          }
        },
        margin: { left: margin, right: margin },
        columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 45, halign: 'right' } },
      })
      y = (doc as any).lastAutoTable.finalY + 8

      // ========== 2. ALTAS Y BAJAS ==========
      checkPage(40)
      addTitle('2. MOVIMIENTOS DE JUGADORES')

      if (altasDelMes.length > 0) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text(`Altas (${altasDelMes.length})`, margin, y)
        y += 4
        autoTable(doc, {
          startY: y,
          head: [['Jugador', 'Fecha alta', 'Estado']],
          body: altasDelMes.map((p) => [
            `${p.firstName} ${p.lastName}`,
            (p.registrationDate instanceof Date ? p.registrationDate : new Date(p.registrationDate)).toLocaleDateString('es-ES'),
            p.status === 'activo' ? 'Activo' : p.status,
          ]),
          headStyles: { fillColor: [21, 128, 61], textColor: 255, fontSize: 9 },
          bodyStyles: { fontSize: 9 },
          margin: { left: margin, right: margin },
        })
        y = (doc as any).lastAutoTable.finalY + 6
      } else {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'italic')
        doc.text('No hubo altas este mes.', margin, y)
        y += 6
      }

      checkPage(30)
      if (bajasDelMes.length > 0) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text(`Bajas (${bajasDelMes.length})`, margin, y)
        y += 4
        autoTable(doc, {
          startY: y,
          head: [['Jugador', 'Fecha baja']],
          body: bajasDelMes.map((p) => [
            `${p.firstName} ${p.lastName}`,
            (p.cancellationDate instanceof Date ? p.cancellationDate : new Date(p.cancellationDate!)).toLocaleDateString('es-ES'),
          ]),
          headStyles: { fillColor: [185, 28, 28], textColor: 255, fontSize: 9 },
          bodyStyles: { fontSize: 9 },
          margin: { left: margin, right: margin },
        })
        y = (doc as any).lastAutoTable.finalY + 8
      } else {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'italic')
        doc.text('No hubo bajas este mes.', margin, y)
        y += 8
      }

      // ========== 3. MOROSIDAD ==========
      checkPage(40)
      addTitle('3. MOROSIDAD Y PAGOS PENDIENTES')

      if (morosos.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [['Jugador', 'Concepto', 'Vencimiento', 'Importe']],
          body: morosos.map((p: any) => [
            p.playerName,
            p.concept,
            (p.dueDate instanceof Date ? p.dueDate : new Date(p.dueDate)).toLocaleDateString('es-ES'),
            fmt(p.amount),
          ]),
          foot: [['', '', 'TOTAL PENDIENTE', fmt(totalMorosidad)]],
          headStyles: { fillColor: [180, 83, 9], textColor: 255, fontSize: 9 },
          bodyStyles: { fontSize: 9 },
          footStyles: { fillColor: [254, 243, 199], textColor: [92, 35, 0], fontStyle: 'bold', fontSize: 9 },
          margin: { left: margin, right: margin },
          columnStyles: { 3: { halign: 'right' } },
        })
        y = (doc as any).lastAutoTable.finalY + 8
      } else {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(21, 128, 61)
        doc.text('✓ No hay pagos pendientes vencidos este mes.', margin, y)
        doc.setTextColor(30, 41, 59)
        y += 8
      }

      // ========== 4. GRUPOS CON MÁS CAMBIOS ==========
      checkPage(40)
      addTitle('4. GRUPOS CON MÁS CAMBIOS')

      if (groupChanges.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [['Grupo', 'Monitor', 'Altas', 'Bajas', 'Total cambios']],
          body: groupChanges.map((g) => [g.name, g.coachName, String(g.altas), String(g.bajas), String(g.altas + g.bajas)]),
          headStyles: { fillColor: [67, 56, 202], textColor: 255, fontSize: 9 },
          bodyStyles: { fontSize: 9 },
          margin: { left: margin, right: margin },
          columnStyles: { 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center', fontStyle: 'bold' } },
        })
        y = (doc as any).lastAutoTable.finalY + 8
      } else {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'italic')
        doc.text('No hubo cambios en grupos este mes.', margin, y)
        y += 8
      }

      // ========== 5. NÓMINAS ESTIMADAS ==========
      checkPage(40)
      addTitle('5. NÓMINAS ESTIMADAS DE MONITORES')

      if (nominasEstimadas.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [['Monitor', 'Grupos', 'Clases part.', 'Eventos', 'Bonificaciones', 'TOTAL']],
          body: nominasEstimadas.map((n) => [
            `${n.coach.firstName} ${n.coach.lastName}`,
            fmt(n.grupos),
            fmt(n.clases),
            fmt(n.eventosTotal),
            fmt(n.bonuses),
            fmt(n.total),
          ]),
          foot: [
            ['TOTAL NÓMINAS', '', '', '', '', fmt(nominasEstimadas.reduce((s, n) => s + n.total, 0))],
          ],
          headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 9 },
          bodyStyles: { fontSize: 9 },
          footStyles: { fillColor: [241, 245, 249], fontStyle: 'bold', fontSize: 9 },
          margin: { left: margin, right: margin },
          columnStyles: {
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right', fontStyle: 'bold' },
          },
        })
        y = (doc as any).lastAutoTable.finalY + 8
      } else {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'italic')
        doc.text('No hay configuraciones de nómina definidas.', margin, y)
        y += 8
      }

      // ---- Footer on all pages ----
      const pageCount = (doc as any).internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(150)
        doc.text(
          `Generado el ${new Date().toLocaleDateString('es-ES')} · Página ${i} de ${pageCount}`,
          pageW / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'center' }
        )
      }

      const pdfBlob = doc.output('blob')
      const finalBlob = new Blob([pdfBlob], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(finalBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Informe_${monthLabel}_${year}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } finally {
      setIsGenerating(false)
    }
  }

  // =====================================
  // EXCEL GENERATION
  // =====================================
  
  const generateExcel = async () => {
    setIsGeneratingExcel(true)
    try {
      const workbook = new ExcelJS.Workbook()
      workbook.creator = club?.name ?? 'San Javier Academy'
      workbook.created = new Date()

      // Worksheet 1: Resumen Económico
      const wsEco = workbook.addWorksheet('Resumen Económico')
      wsEco.columns = [
        { header: 'Concepto', key: 'concepto', width: 40 },
        { header: 'Importe (€)', key: 'importe', width: 20 },
      ]
      wsEco.addRow({ concepto: 'Ingresos por cuotas', importe: ingresosCuotas })
      wsEco.addRow({ concepto: 'Ingresos por eventos', importe: ingresosEventos })
      wsEco.addRow({ concepto: 'Ingresos por clases', importe: ingresosClases })
      wsEco.addRow({ concepto: 'Otros ingresos', importe: extrasIngresos })
      wsEco.addRow({ concepto: 'TOTAL INGRESOS', importe: totalIngresos })
      wsEco.addRow({ concepto: 'Gastos de eventos', importe: -gastosEventos })
      wsEco.addRow({ concepto: 'Gastos de explotación y nóminas', importe: -extrasGastos })
      wsEco.addRow({ concepto: 'BENEFICIO NETO', importe: beneficioNetoTotal })
      
      wsEco.getRow(1).font = { bold: true }
      wsEco.getRow(6).font = { bold: true }
      wsEco.getRow(9).font = { bold: true }

      // Worksheet 2: Altas y Bajas
      const wsAltasBajas = workbook.addWorksheet('Movimientos Jugadores')
      wsAltasBajas.columns = [
        { header: 'Tipo', key: 'tipo', width: 15 },
        { header: 'Jugador', key: 'jugador', width: 30 },
        { header: 'Fecha', key: 'fecha', width: 20 },
      ]
      
      altasDelMes.forEach(p => {
        wsAltasBajas.addRow({ tipo: 'ALTA', jugador: `${p.firstName} ${p.lastName}`, fecha: (p.registrationDate instanceof Date ? p.registrationDate : new Date(p.registrationDate)).toLocaleDateString('es-ES') })
      })
      bajasDelMes.forEach(p => {
        wsAltasBajas.addRow({ tipo: 'BAJA', jugador: `${p.firstName} ${p.lastName}`, fecha: (p.cancellationDate instanceof Date ? p.cancellationDate : new Date(p.cancellationDate!)).toLocaleDateString('es-ES') })
      })
      wsAltasBajas.getRow(1).font = { bold: true }

      // Worksheet 3: Morosidad
      const wsMorosos = workbook.addWorksheet('Morosidad')
      wsMorosos.columns = [
        { header: 'Jugador', key: 'jugador', width: 30 },
        { header: 'Concepto', key: 'concepto', width: 30 },
        { header: 'Vencimiento', key: 'vencimiento', width: 20 },
        { header: 'Importe (€)', key: 'importe', width: 15 },
      ]
      morosos.forEach((p: any) => {
        wsMorosos.addRow({
          jugador: p.playerName,
          concepto: p.concept,
          vencimiento: (p.dueDate instanceof Date ? p.dueDate : new Date(p.dueDate)).toLocaleDateString('es-ES'),
          importe: p.amount
        })
      })
      wsMorosos.getRow(1).font = { bold: true }

      // Worksheet 4: Grupos
      const wsGrupos = workbook.addWorksheet('Cambios Grupos')
      wsGrupos.columns = [
        { header: 'Grupo', key: 'grupo', width: 25 },
        { header: 'Monitor', key: 'monitor', width: 25 },
        { header: 'Altas', key: 'altas', width: 15 },
        { header: 'Bajas', key: 'bajas', width: 15 },
        { header: 'Total Movimientos', key: 'total', width: 20 },
      ]
      groupChanges.forEach(g => {
        wsGrupos.addRow({
          grupo: g.name,
          monitor: g.coachName,
          altas: g.altas,
          bajas: g.bajas,
          total: g.altas + g.bajas
        })
      })
      wsGrupos.getRow(1).font = { bold: true }

      // Worksheet 5: Nóminas
      const wsNominas = workbook.addWorksheet('Nóminas')
      wsNominas.columns = [
        { header: 'Monitor', key: 'monitor', width: 30 },
        { header: 'Grupos (€)', key: 'grupos', width: 15 },
        { header: 'Clases part. (€)', key: 'clases', width: 15 },
        { header: 'Eventos (€)', key: 'eventos', width: 15 },
        { header: 'Bonus (€)', key: 'bonus', width: 15 },
        { header: 'TOTAL (€)', key: 'total', width: 15 },
      ]
      nominasEstimadas.forEach(n => {
        wsNominas.addRow({
          monitor: `${n.coach.firstName} ${n.coach.lastName}`,
          grupos: n.grupos,
          clases: n.clases,
          eventos: n.eventosTotal,
          bonus: n.bonuses,
          total: n.total
        })
      })
      wsNominas.getRow(1).font = { bold: true }

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Informe_${monthLabel}_${year}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)

    } finally {
      setIsGeneratingExcel(false)
    }
  }

  // =====================================
  // RENDER
  // =====================================

  return (
    <div>
      <Header
        title="Informes Mensuales"
        subtitle="Genera informes económicos y de actividad en PDF"
      />

      <div className="p-6 space-y-6">
        {/* Selector de mes/año */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Seleccionar período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Mes</label>
                <Select
                  options={MONTHS}
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </div>
              <div className="w-32 space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Año</label>
                <Select
                  options={YEARS}
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={generatePDF} disabled={isGenerating || isGeneratingExcel} className="gap-2">
                  {isGenerating ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      PDF...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      PDF
                    </>
                  )}
                </Button>
                <Button onClick={generateExcel} disabled={isGenerating || isGeneratingExcel} variant="outline" className="gap-2 border-green-600 text-green-600 hover:bg-green-50">
                  {isGeneratingExcel ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Excel...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Excel
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview: Resumen económico */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Euro className="h-4 w-4" />
                Total ingresos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIngresos)}</p>
                  <p className="text-xs text-muted-foreground mt-1 text-wrap">
                    Cuotas {formatCurrency(ingresosCuotas)} · Eventos {formatCurrency(ingresosEventos)} · Clases {formatCurrency(ingresosClases)}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-[10px] uppercase font-bold border-purple-200 text-purple-600 hover:bg-purple-50"
                  onClick={() => setDetailsView('ingresos_eventos')}
                >
                  Detalle Eventos
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Gastos del mes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalGastos)}</p>
              <p className="text-xs text-muted-foreground mt-1">Eventos {formatCurrency(gastosEventos)} · Explotación {formatCurrency(extrasGastos)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Beneficio neto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${beneficioNetoTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(beneficioNetoTotal)}
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setDetailsView('altas_bajas')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Altas / Bajas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                <span className="text-green-600">+{altasDelMes.length}</span>
                <span className="text-muted-foreground mx-2 font-light">/</span>
                <span className="text-red-600">-{bajasDelMes.length}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">jugadores este mes</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setDetailsView('morosos')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Morosidad
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${morosos.length > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {formatCurrency(totalMorosidad)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{morosos.length} recibo(s) pendiente(s)</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setDetailsView('grupos')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Cambios en grupos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{groupChanges.length}</p>
              <p className="text-xs text-muted-foreground mt-1">
                grupos con movimientos
                {groupChanges.length > 0 && ` · ${groupChanges[0].name} lidera`}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Preview nóminas */}
        {nominasEstimadas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Euro className="h-4 w-4" />
                Nóminas estimadas — {monthLabel} {year}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {nominasEstimadas.map(({ coach, total, grupos, clases, eventosTotal, bonuses }) => (
                  <div key={coach.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-sm">{coach.firstName} {coach.lastName}</p>
                      <p className="text-xs text-muted-foreground">
                        Grupos {formatCurrency(grupos)} · Clases {formatCurrency(clases)} · Eventos {formatCurrency(eventosTotal)}
                        {bonuses > 0 ? ` · Bonus ${formatCurrency(bonuses)}` : ''}
                      </p>
                    </div>
                    <p className="font-bold text-lg">{formatCurrency(total)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t flex justify-between font-semibold">
                <span>Total nóminas</span>
                <span>{formatCurrency(nominasEstimadas.reduce((s, n) => s + n.total, 0))}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* MODALES DE DETALLE */}
      <Dialog open={detailsView === 'altas_bajas'} onOpenChange={(open) => !open && setDetailsView(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de Altas y Bajas ({monthLabel} {year})</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            <div>
              <h3 className="font-semibold text-green-600 mb-2">Altas ({altasDelMes.length})</h3>
              {altasDelMes.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Jugador</TableHead>
                      <TableHead>Fecha Alta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {altasDelMes.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>{p.firstName} {p.lastName}</TableCell>
                        <TableCell>{(p.registrationDate instanceof Date ? p.registrationDate : new Date(p.registrationDate)).toLocaleDateString('es-ES')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No hubo altas este mes.</p>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-red-600 mb-2">Bajas ({bajasDelMes.length})</h3>
              {bajasDelMes.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Jugador</TableHead>
                      <TableHead>Fecha Baja</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bajasDelMes.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>{p.firstName} {p.lastName}</TableCell>
                        <TableCell>{(p.cancellationDate instanceof Date ? p.cancellationDate : new Date(p.cancellationDate!)).toLocaleDateString('es-ES')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No hubo bajas este mes.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsView === 'morosos'} onOpenChange={(open) => !open && setDetailsView(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de Morosidad ({monthLabel} {year})</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {morosos.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jugador</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {morosos.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.playerName}</TableCell>
                      <TableCell>{p.concept}</TableCell>
                      <TableCell className="text-red-600">{(p.dueDate instanceof Date ? p.dueDate : new Date(p.dueDate)).toLocaleDateString('es-ES')}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No hay pagos pendientes vencidos este mes.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsView === 'grupos'} onOpenChange={(open) => !open && setDetailsView(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cambios en Grupos ({monthLabel} {year})</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {groupChanges.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grupo</TableHead>
                    <TableHead>Monitor</TableHead>
                    <TableHead className="text-center text-green-600">Altas (Mes)</TableHead>
                    <TableHead className="text-center text-red-600">Bajas (Mes)</TableHead>
                    <TableHead className="text-center">Total Movimientos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupChanges.map((g, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{g.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{g.coachName}</TableCell>
                      <TableCell className="text-center text-green-600 font-semibold">+{g.altas}</TableCell>
                      <TableCell className="text-center text-red-600 font-semibold">-{g.bajas}</TableCell>
                      <TableCell className="text-center font-bold">{g.altas + g.bajas}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No hubo movimientos en grupos este mes.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={detailsView === 'ingresos_eventos'} onOpenChange={(open) => !open && setDetailsView(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de Ingresos por Eventos ({monthLabel} {year})</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <p className="text-sm text-muted-foreground mb-4">
              Estos son todos los cobros recibidos este mes categorizados como "Eventos".
            </p>
            {currentMonthAllPayments.filter(p => p.source === 'evento' && p.status === 'pagado').length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha Pago</TableHead>
                    <TableHead>Jugador</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentMonthAllPayments
                    .filter(p => p.source === 'evento' && p.status === 'pagado')
                    .sort((a, b) => {
                      const da = a.paidDate ? new Date(a.paidDate).getTime() : 0
                      const db = b.paidDate ? new Date(b.paidDate).getTime() : 0
                      return db - da
                    })
                    .map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs">
                          {p.paidDate ? (p.paidDate instanceof Date ? p.paidDate : new Date(p.paidDate)).toLocaleDateString('es-ES') : '-'}
                        </TableCell>
                        <TableCell className="font-medium">{p.playerName}</TableCell>
                        <TableCell>{p.concept}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(p.amount)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-bold">TOTAL EVENTOS</TableCell>
                    <TableCell className="text-right font-bold text-lg text-primary">
                      {formatCurrency(ingresosEventos)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            ) : (
              <p className="text-center py-8 text-muted-foreground">No hay ingresos de eventos este mes.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
