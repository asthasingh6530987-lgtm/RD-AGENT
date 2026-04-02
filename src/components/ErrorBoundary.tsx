import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: string | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error.message, errorInfo.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 relative overflow-hidden">
          {/* Background Accents */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand/5 rounded-full -mr-64 -mt-64 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gold/5 rounded-full -ml-64 -mb-64 blur-3xl"></div>

          <div className="relative z-10 bg-white rounded-[3rem] shadow-premium p-10 sm:p-12 max-w-xl w-full border border-brand/10 text-center">
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 bg-brand/10 rounded-3xl flex items-center justify-center mb-8 shadow-inner-light">
                <ShieldAlert className="w-12 h-12 text-brand" />
              </div>
              
              <h1 className="text-3xl font-black text-slate-900 mb-4 uppercase tracking-tight">
                Something went <span className="text-brand">wrong</span>
              </h1>
              
              <p className="text-slate-500 font-medium text-lg leading-relaxed mb-8">
                An unexpected error occurred while processing your request. Our team has been notified.
              </p>

              {this.state.error && (
                <div className="w-full bg-slate-50 border-2 border-slate-100 p-6 rounded-2xl text-left mb-10 overflow-hidden">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Error Details</p>
                  <div className="text-xs text-red-600 font-black font-mono break-all leading-relaxed">
                    {this.state.error}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <button
                  onClick={this.handleReload}
                  className="flex-1 flex items-center justify-center gap-3 px-8 py-4 bg-gradient-brand text-white rounded-2xl font-black transition-all shadow-premium hover-lift uppercase tracking-[0.1em] text-xs"
                >
                  <RefreshCw className="w-5 h-5" />
                  Reload Page
                </button>
                <button
                  onClick={this.handleGoHome}
                  className="flex-1 flex items-center justify-center gap-3 px-8 py-4 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-50 transition-all hover-lift uppercase tracking-[0.1em] text-xs"
                >
                  <Home className="w-5 h-5" />
                  Go to Home
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
