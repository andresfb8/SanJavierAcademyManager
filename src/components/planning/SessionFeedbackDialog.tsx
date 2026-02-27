import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star } from 'lucide-react';

interface SessionFeedbackDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (feedback?: { rating?: number; notes?: string }) => void;
    sessionName: string;
}

export function SessionFeedbackDialog({ isOpen, onClose, onConfirm, sessionName }: SessionFeedbackDialogProps) {
    const [rating, setRating] = useState<number>(0);
    const [notes, setNotes] = useState('');

    const handleConfirm = () => {
        onConfirm({ rating: rating > 0 ? rating : undefined, notes });
        setRating(0);
        setNotes('');
    };

    const handleSkip = () => {
        onConfirm(undefined);
        setRating(0);
        setNotes('');
    };

    // Reset state when opening
    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setRating(0);
            setNotes('');
        }
        onClose();
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Completar Sesión</DialogTitle>
                    <DialogDescription>
                        Sesión: {sessionName}. ¿Quieres dejar algún comentario sobre cómo ha ido la clase?
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Valoración (opcional)</label>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    className={`p-1 hover:scale-110 transition-transform ${rating >= star ? 'text-yellow-400' : 'text-gray-200'}`}
                                >
                                    <Star className="w-8 h-8 fill-current" />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Notas (opcional)</label>
                        <Textarea
                            placeholder="¿Qué tal han respondido los jugadores a los ejercicios?"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                        />
                    </div>
                </div>

                <DialogFooter className="flex gap-2">
                    <Button variant="outline" onClick={handleSkip}>
                        Saltar Feedback y Completar
                    </Button>
                    <Button onClick={handleConfirm} disabled={!rating && !notes}>
                        Guardar Feedback
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
