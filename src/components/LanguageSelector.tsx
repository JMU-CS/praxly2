/**
 * LanguageSelector component that provides a dropdown menu for selecting
 * the target programming language (Python, Java, CSP, Praxis, or AST).
 */

import React from 'react';
import { ChevronDown } from 'lucide-react';

export type SupportedLang = 'python' | 'java' | 'csp' | 'praxis' | 'ast';

interface LanguageSelectorProps {
  value: SupportedLang;
  onChange: (lang: SupportedLang) => void;
  includeAst?: boolean;
  hideDropdownChevron?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  value,
  onChange,
  includeAst = false,
  hideDropdownChevron = false,
}) => {
  const languages = includeAst
    ? ['ast', 'csp', 'java', 'praxis', 'python']
    : ['csp', 'java', 'praxis', 'python'];

  return (
    <div className="flex items-center relative group h-full">
      <button className="flex items-center gap-2 py-2 text-indigo-400 hover:text-indigo-300 transition-colors uppercase">
        {value === 'ast' ? 'AST VIEW' : value}
        {!hideDropdownChevron && <ChevronDown size={12} />}
      </button>
      <div className="absolute top-full left-0 w-40 bg-slate-800 border border-slate-700 hidden group-hover:block rounded-md shadow-xl overflow-hidden mt-1 z-[110]">
        {languages.map((lang) => (
          <button
            key={lang}
            onClick={() => onChange(lang as SupportedLang)}
            className="block w-full text-left px-4 py-2 text-xs hover:bg-slate-700 transition-colors uppercase"
          >
            {lang === 'ast' ? 'AST View' : lang}
          </button>
        ))}
      </div>
    </div>
  );
};
