export type ParameterCategory = 'tecnica' | 'tactica' | 'mental' | 'fisica' | 'conducta'
export type ParameterLevel = 'todos' | 'iniciacion' | 'intermedio' | 'avanzado' | 'competicion' | 'menores'

export interface MethodologyParameter {
    id: string
    name: string
    category: ParameterCategory
    level: ParameterLevel | ParameterLevel[] // Puede aplicar a uno o varios niveles
    description?: string
    videoUrl?: string // YouTube, Vimeo, etc.
    documentUrl?: string // PDF, Drive, etc.
    tags: string[] // Para filtrado flexible (ej: "saque", "red", "fondo")
    isGlobal: boolean // Si es true, es parte del catálogo principal. Si es false, fue clonado/customizado por un entrenador (Fase 2)
    createdBy?: string // userId del creador
    createdAt: Date
    updatedAt: Date
}

// Representa el "peso" o importancia de un parámetro en un plan (el sistema de "pelotitas")
// Este es el puente entre el catálogo global y el entrenamiento específico
export interface ParameterWeight {
    parameterId: string
    weight: number // 1 a 3 (o 1 a 5) "pelotitas"
    notes?: string // Notas específicas del entrenador para este parámetro en este plan
}

export interface TrainingPlan {
    id: string
    name: string
    groupId: string // A qué grupo se aplica
    coachId: string
    startDate: Date
    endDate: Date
    parameters: ParameterWeight[]
    focusOfTheWeek?: string
    createdAt: Date
    updatedAt: Date
}
