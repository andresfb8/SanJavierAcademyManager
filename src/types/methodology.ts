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

// Fase 2: Plantillas Globales
export interface TrainingSession {
    dayNumber: number; // 1, 2, 3... (dentro de esa semana)
    parameters: ParameterWeight[];
}

export interface TrainingWeek {
    weekNumber: number; // 1, 2, 3...
    sessions: TrainingSession[];
    focus?: string;
}

export interface TrainingTemplate {
    id: string;
    name: string;
    description?: string;
    level: ParameterLevel | ParameterLevel[];
    weeksCount: number; // Duración en semanas (ej: 4)
    daysPerWeek: number; // Frecuencia semanal esperada (ej: 2)
    weeks: TrainingWeek[]; // El contenido de cada semana
    createdBy: string; // userId del Director/Coor que lo creó
    isGlobal: boolean; // Si la plantilla está disponible para todos los del club
    createdAt: Date;
    updatedAt: Date;
}

export interface GroupPlanAssignment {
    id: string;
    groupId: string;
    templateId: string;
    assignedBy: string; // userId
    startDate: Date; // Fecha a partir de la cual empieza el "Día 1" de la "Semana 1"
    isActive: boolean;
    createdAt: Date;
}

export interface GroupSessionRecord {
    id: string;
    groupId: string;
    assignmentId: string; // Link a la asignación de la plantilla
    weekNumber: number;
    dayNumber: number;
    plannedDate: Date; // La fecha en la que originalmente tocaba o toca
    status: 'completed' | 'skipped' | 'pending';
    rescheduledDates?: Date[]; // Fechas en las que esta sesión tocaba pero fue desplazada
    feedback?: {
        rating?: number; // 1-5 estrellas opcional
        notes?: string;
    };
    completedAt?: Date;
    completedBy?: string; // userId del entrenador
}
