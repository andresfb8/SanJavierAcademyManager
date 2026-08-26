import { AcademyEvent, EventPayment, CoachSalaryConfig, PrivateLesson } from '@/types'

/**
 * Calcula el salario de un entrenador para un evento específico.
 * 
 * Reglas de negocio:
 * 1. Base: Beneficio Neto (Ingresos pagados - Gastos del evento).
 * 2. Si el beneficio es negativo, se asume 0 para el cálculo del salario.
 * 3. Reparto: El resultado se divide entre el número de monitores asignados al evento.
 * 4. Tipos: Puede ser porcentaje (%) sobre el beneficio neto o cantidad fija (€) por evento.
 */
export function calculateEventSalary(
  event: AcademyEvent,
  eventPayments: EventPayment[],
  salaryConfig: CoachSalaryConfig
): number {
  // 1. Calcular ingresos totales (solo lo pagado)
  const totalIngresos = eventPayments
    .filter((ep) => ep.eventId === event.id && ep.status === 'pagado')
    .reduce((s, ep) => s + ep.amount, 0)

  // 2. Calcular gastos totales del evento
  const totalGastos = (event.expenses ?? []).reduce((s, ex) => s + ex.amount, 0)

  // 3. Beneficio Neto (mínimo 0)
  const beneficioNeto = Math.max(0, totalIngresos - totalGastos)

  // 4. Número de monitores para dividir el esfuerzo/pago
  const numCoaches = event.coachIds.length || 1

  // 5. Cálculo según tipo
  if (salaryConfig.eventPaymentType === 'percentage') {
    // Porcentaje del beneficio neto dividido entre los monitores
    const rate = salaryConfig.eventRate || 0
    return (beneficioNeto * (rate / 100)) / numCoaches
  } else {
    // Cantidad fija dividida entre los monitores
    const fixedRate = salaryConfig.eventRate || 0
    return fixedRate / numCoaches
  }
}

/**
 * Calcula la comision del entrenador por una clase particular, segun el
 * mismo criterio ya usado (duplicado) en CoachesPage, CoachDashboard,
 * CoachProfilePage, PayrollCloseDialog y ReportsPage: tarifa fija por clase,
 * o porcentaje sobre el precio de la clase.
 */
export function calculatePrivateLessonSalary(
  lesson: PrivateLesson,
  salaryConfig: CoachSalaryConfig
): number {
  if (salaryConfig.privateLessonPaymentType === 'fixed') {
    return salaryConfig.privateLessonRate || 0
  }
  return lesson.price * ((salaryConfig.privateLessonRate || 0) / 100)
}
