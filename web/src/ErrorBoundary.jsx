import React from 'react';
import { reportError } from './analytics';

export class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    reportError(error, { componentStack: info?.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-200 p-6">
          <div className="text-center space-y-4 max-w-sm">
            <p className="text-lg font-bold">Algo ha ido mal</p>
            <p className="text-sm text-zinc-400">
              Se ha producido un error inesperado. Prueba a recargar la página; si el problema persiste,
              contacta con soporte@mygarageops.com.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold"
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
