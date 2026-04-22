/**
 * LandingPage component that displays the main landing/home page.
 * Provides navigation to the editor with project information and feature highlights.
 */

import { Link } from 'react-router-dom';
import { Code, ArrowRight, CheckCircle } from 'lucide-react';

/**
 * Runs landing page.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-5 sm:p-8 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-[-15%] left-[-20%] w-[360px] h-[360px] sm:w-[500px] sm:h-[500px] bg-indigo-900/30 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-15%] right-[-20%] w-[360px] h-[360px] sm:w-[500px] sm:h-[500px] bg-emerald-900/20 rounded-full blur-[100px]" />

      <div className="w-full max-w-5xl text-center space-y-7 sm:space-y-8 relative z-10">
        <div className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm text-slate-400 mb-2 sm:mb-4">
          <Code size={16} className="text-indigo-400" />
          <span>Praxly 2.0 is currently in Alpha</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight text-white leading-tight">
          Master Coding with{' '}
          <span className="block sm:inline text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            Language Translation
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed px-2 sm:px-0">
          A visual programming environment that bridges the gap between pseudocode and standard
          programming languages.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 pt-2 sm:pt-4 px-2 sm:px-0">
          <Link
            to="/v2/editor"
            className="flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-lg transition-all hover:scale-[1.02] shadow-lg shadow-indigo-900/50 w-full sm:w-auto"
          >
            Launch Praxly 2.0 <ArrowRight size={20} />
          </Link>
          <a
            href="https://github.com/JMU-CS/praxly2/"
            target="_blank"
            rel="noreferrer"
            className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-all w-full sm:w-auto"
          >
            View on GitHub
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 text-left pt-8 sm:pt-12 px-2 sm:px-0">
          {['Compile multiple languages', 'Redesigned user interface', 'Free and open source'].map(
            (feat, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-slate-300 bg-slate-900/40 border border-slate-800/70 rounded-lg px-3 py-2"
              >
                <CheckCircle size={20} className="text-emerald-500 shrink-0" />
                <span>{feat}</span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
