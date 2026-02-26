import React from 'react';
import { cn } from '@/lib/utils';
import { Circle } from 'lucide-react';

interface ParameterWeightControlProps {
    value: number; // 1 to 3
    onChange: (value: number) => void;
    readonly?: boolean;
}

export const ParameterWeightControl: React.FC<ParameterWeightControlProps> = ({
    value,
    onChange,
    readonly = false
}) => {
    // We visually represent up to 3 "pelotitas"
    const maxPelotitas = 3;

    return (
        <div className="flex items-center gap-1">
            {[...Array(maxPelotitas)].map((_, index) => {
                const isActive = index < value;
                const pelotitaValue = index + 1;

                return (
                    <button
                        key={index}
                        type="button"
                        onClick={() => {
                            if (!readonly) {
                                // Double click on the single active one often means "clear" or "1"
                                // Let's keep it simple: just sets the value.
                                onChange(pelotitaValue);
                            }
                        }}
                        disabled={readonly}
                        className={cn(
                            "focus:outline-none transition-colors rounded-full",
                            readonly ? "cursor-default" : "cursor-pointer hover:bg-gray-100 p-0.5",
                            isActive ? "text-blue-600" : "text-gray-300"
                        )}
                        title={`Prioridad ${pelotitaValue}`}
                    >
                        {isActive ? (
                            <div className="w-5 h-5 rounded-full bg-blue-600 shadow-sm border border-blue-700" />
                        ) : (
                            <Circle className="w-5 h-5 text-gray-300" />
                        )}
                    </button>
                );
            })}
        </div>
    );
};
