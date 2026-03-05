import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, CalendarHeart } from 'lucide-react';
import { useDataStore } from '@/stores/dataStore';
import { formatDate } from '@/lib/utils';
import { ConfirmDialog } from '../shared/ConfirmDialog';

export const HolidaysManager: React.FC = () => {
    const { holidays, addHolidayStore, deleteHolidayStore } = useDataStore();
    const [adding, setAdding] = useState(false);

    // Form state
    const [dateInput, setDateInput] = useState('');
    const [descriptionInput, setDescriptionInput] = useState('');

    // Delete dialog
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const handleAdd = async () => {
        if (!dateInput) return;
        try {
            setAdding(true);
            const dateObj = new Date(dateInput);
            dateObj.setHours(12, 0, 0, 0);
            await addHolidayStore(dateObj, descriptionInput);

            setDateInput('');
            setDescriptionInput('');
        } catch (error) {
            console.error(error);
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteHolidayStore(deleteId);
        } catch (error) {
            console.error(error);
        } finally {
            setDeleteId(null);
        }
    };

    return (
        <Card className="mt-4">
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                    <CalendarHeart className="h-5 w-5 text-primary" /> Días Festivos
                </CardTitle>
                <CardDescription>Añade los días en los que no habrá clase o se marcarán visualmente como festivos en la planificación de los grupos.</CardDescription>
            </CardHeader>
            <CardContent>
                {/* Formulario de Alta */}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-4 mb-6 items-end p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="space-y-2">
                        <Label htmlFor="holiday-date">Fecha del Festivo *</Label>
                        <Input
                            id="holiday-date"
                            type="date"
                            value={dateInput}
                            onChange={(e) => setDateInput(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="holiday-description">Descripción / Motivo</Label>
                        <Input
                            id="holiday-description"
                            placeholder="Ej: Navidad, Semana Santa, Día de la Región..."
                            value={descriptionInput}
                            onChange={(e) => setDescriptionInput(e.target.value)}
                        />
                    </div>
                    <div>
                        <Button onClick={handleAdd} disabled={!dateInput || adding} className="w-full">
                            {adding ? "Añadiendo..." : "Añadir Festivo"}
                        </Button>
                    </div>
                </div>

                {/* Lista de Festivos */}
                <div className="space-y-4">
                    <h3 className="text-sm font-medium">Festivos Programados</h3>
                    {holidays.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No hay días festivos configurados.</p>
                    ) : (
                        <ul className="divide-y divide-gray-100 border rounded-md">
                            {holidays.map((h) => (
                                <li key={h.id} className="p-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                    <div>
                                        <p className="font-semibold text-gray-900">{formatDate(h.date)}</p>
                                        {h.description && <p className="text-xs text-gray-500">{h.description}</p>}
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-red-50" onClick={() => setDeleteId(h.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <ConfirmDialog
                    open={!!deleteId}
                    onOpenChange={() => setDeleteId(null)}
                    title="Eliminar festivo"
                    description="¿Seguro que quieres borrar este día festivo? Las sesiones agrupadas no se recalcularán automáticamente de inmediato, el calendario se ajustará la próxima vez que se lea la planificación."
                    variant="destructive"
                    confirmLabel="Eliminar"
                    onConfirm={handleDelete}
                />
            </CardContent>
        </Card>
    );
};
