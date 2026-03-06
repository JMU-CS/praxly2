/**
 * OutputPanel component that displays program output, errors, and variable state.
 * Shows runtime results with formatted value display and variable inspection.
 */

import React from 'react';
import { Terminal, AlertCircle, X } from 'lucide-react';
import { ResizeHandle } from './ResizeHandle';

interface OutputPanelProps {
    output: string[];
    error?: string | null;
    variables?: Record<string, any>;
    showVariables?: boolean;
    height?: number;
    resizeActive?: boolean;
    onResize?: (e: React.MouseEvent) => void;
    onClose?: () => void;
}

const formatVariableValue = (value: any): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') return `"${value}"`;
    if (Array.isArray(value)) {
        return `[${value.map(v => formatVariableValue(v)).join(', ')}]`;
    }
    if (typeof value === 'object' && value.klass?.name) {
        return `${value.klass.name} instance`;
    }
    if (typeof value === 'object' && value.klass) {
        return `JavaClass(${(value as any).name || 'unknown'})`;
    }
    return String(value);
};

export const OutputPanel: React.FC<OutputPanelProps> = ({
    output,
    error,
    variables = {},
    showVariables = false,
    height,
    resizeActive = false,
    onResize,
    onClose,
}) => {
    const containerStyle = height ? { height } : undefined;

    return (
        <div
            className="border-t border-slate-800 flex gap-0 bg-slate-900 shrink-0 z-[60] relative"
            style={containerStyle}
        >
            {/* Resize Handle */}
            {onResize && <ResizeHandle direction="vertical" isActive={resizeActive} onMouseDown={onResize} />}

            {/* Variables Panel */}
            {showVariables && (
                <div className="flex flex-col border-r border-slate-800 w-64 shrink-0">
                    <div className="h-8 flex items-center px-4 bg-slate-900 border-b border-slate-800 shrink-0">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Variables</span>
                    </div>
                    <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-5 bg-slate-950">
                        {Object.keys(variables).length === 0 ? (
                            <div className="text-slate-700 italic opacity-40">No variables</div>
                        ) : (
                            Object.entries(variables).map(([name, value]) => {
                                if (typeof value === 'function' || name.startsWith('_')) return null;
                                const valueStr = formatVariableValue(value);
                                return (
                                    <div key={name} className="flex justify-between gap-2 py-1">
                                        <span className="text-slate-400">{name}:</span>
                                        <span className="text-slate-300 font-semibold">{valueStr}</span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* Output Panel */}
            <div className="flex-1 flex flex-col border-r border-slate-800 overflow-hidden">
                <div className="h-8 flex items-center px-4 bg-slate-900 border-b border-slate-800 shrink-0 justify-between">
                    <div className="flex items-center gap-2">
                        <Terminal size={14} className="text-indigo-400" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            Console Output
                        </span>
                        {error && (
                            <div className="ml-4 flex items-center gap-2 text-red-400 text-[10px] font-bold animate-pulse">
                                <AlertCircle size={12} />
                                {error}
                            </div>
                        )}
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-1 text-slate-600 hover:text-slate-400 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
                <div className="flex-1 overflow-auto p-4 font-mono text-sm leading-6 bg-slate-950">
                    {output.length === 0 && !error ? (
                        <div className="text-slate-700 italic opacity-40">Run code to see execution results...</div>
                    ) : (
                        output.map((line, idx) => (
                            <div key={idx} className="flex gap-4 border-b border-slate-900/40 last:border-0 py-0.5">
                                <span className="text-slate-700 select-none w-6 text-right text-xs pt-1">
                                    {idx + 1}
                                </span>
                                <span className="text-slate-300 break-all">{line}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
