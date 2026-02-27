import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CalendarX, CalendarClock } from 'lucide-react';

interface RescheduleDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSkip: () => void;
    onReschedule: () => void;
}

export function RescheduleDialog({ isOpen, onClose, onSkip, onReschedule }: RescheduleDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Suspender Clase</DialogTitle>
                    <DialogDescription>
                        Ha surgido un imprevisto. ¿Qué quieres hacer con el contenido planificado para hoy?
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                    <button
                        onClick={onSkip}
                        className="flex flex-col items-center p-4 border rounded-lg hover:border-red-400 hover:bg-red-50 transition-colors text-center gap-3"
                    >
                        <div className="p-3 bg-red-100 rounded-full text-red-600">
                            <CalendarX className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-1">Saltar Clase</h4>
                            <p className="text-xs text-gray-500">El contenido se pierde. La próxima clase seguirá con el plan habitual.</p>
                        </div>
                    </button>

                    <button
                        onClick={onReschedule}
                        className="flex flex-col items-center p-4 border rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-center gap-3"
                    >
                        <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                            <CalendarClock className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-1">Desplazar Clase</h4>
                            <p className="text-xs text-gray-500">El contenido de hoy se dará en la próxima clase empujando el calendario un día.</p>
                        </div>
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
