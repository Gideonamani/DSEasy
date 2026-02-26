import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service here
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    // Optional: reload the page or triggers a route change to fully clear state
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="error-container" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-4)' }}>
          <AlertTriangle size={48} color="var(--danger-color)" />
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-bold)", color: "var(--text-primary)" }}>
            Something went wrong
          </h2>
          <p style={{ color: "var(--text-secondary)", textAlign: "center", maxWidth: "400px" }}>
            {this.state.error?.message || "An unexpected error occurred while loading this component."}
          </p>
          <button 
            onClick={this.handleReset}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 'var(--space-2)', 
              padding: 'var(--space-2) var(--space-4)', 
              backgroundColor: 'var(--primary-color)', 
              color: 'white', 
              border: 'none', 
              borderRadius: 'var(--radius-md)', 
              cursor: 'pointer',
              fontWeight: "var(--font-medium)"
            }}
          >
            <RefreshCw size={16} />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}
