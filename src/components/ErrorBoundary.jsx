import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// Catches render-time errors in any child view and shows a friendly panel
// instead of blanking the entire screen (the old "white screen" behaviour).
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('View crashed:', error, info);
  }

  // Reset when the route changes so navigating away clears the error
  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4rem 2rem', gap: '1rem' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={28} color="#EF4444" />
          </div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>Something went wrong on this page</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '420px' }}>
            This section hit an unexpected error, but the rest of the app is still working. Try reloading, or head back to the dashboard.
          </p>
          <button
            className="btn btn-primary"
            style={{ display: 'inline-flex', gap: '0.5rem', marginTop: '0.5rem' }}
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={16} /> Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
