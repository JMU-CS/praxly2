/**
 * CodeEditorPanel component that displays a code editor with syntax highlighting,
 * language selection, and resizable layout support.
 * Wraps CodeMirror editor with custom configuration and decorations.
 */

import React, { type ReactNode } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { ResizeHandle } from './ResizeHandle';
import { LanguageSelector, type SupportedLang } from './LanguageSelector';
import { getCodeMirrorExtensions } from '../utils/editorUtils';

interface CodeEditorPanelProps {
    value: string;
    onChange: (val: string) => void;
    language: SupportedLang;
    onLanguageChange?: (lang: SupportedLang) => void;
    title: string;
    width?: number;
    readOnly?: boolean;
    editable?: boolean;
    resizable?: boolean;
    resizeActive?: boolean;
    onResize?: (e: React.MouseEvent) => void;
    header?: ReactNode;
    className?: string;
    onCreateEditor?: (view: any) => void;
}

export const CodeEditorPanel: React.FC<CodeEditorPanelProps> = ({
    value,
    onChange,
    language,
    onLanguageChange,
    title,
    width,
    readOnly,
    editable = true,
    resizable = false,
    resizeActive = false,
    onResize,
    header,
    className = '',
    onCreateEditor,
}) => {
    const containerStyle = width ? { width } : undefined;

    return (
        <div className="flex shrink-0 relative group/editor z-[10]" style={containerStyle}>
            <div className={`flex-1 flex flex-col border-r border-slate-800 overflow-hidden ${className}`}>
                {/* Header */}
                <div className="h-10 bg-slate-900 flex items-center justify-between px-4 border-b border-slate-800 text-[10px] font-bold uppercase tracking-widest text-slate-500 shrink-0">
                    <div className="flex items-center">
                        {onLanguageChange ? (
                            <LanguageSelector value={language} onChange={onLanguageChange} />
                        ) : (
                            <span>{language}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {header}
                        <span>{title}</span>
                    </div>
                </div>

                {/* Editor */}
                <div className="flex-1 relative bg-slate-950 overflow-hidden">
                    <CodeMirror
                        value={value}
                        height="100%"
                        theme={vscodeDark}
                        extensions={getCodeMirrorExtensions(language)}
                        onChange={onChange}
                        readOnly={readOnly}
                        editable={editable}
                        onCreateEditor={onCreateEditor}
                        className={`text-sm h-full font-mono ${className}`}
                    />
                </div>
            </div>

            {/* Resize Handle */}
            {resizable && onResize && (
                <ResizeHandle direction="horizontal" isActive={resizeActive} onMouseDown={onResize} />
            )}
        </div>
    );
};
