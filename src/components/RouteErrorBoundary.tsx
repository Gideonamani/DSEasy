import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RawRouteErrorBoundaryProps {
  children?: ReactNode;
  navigate: (path: string) => void;
  featureName?: string;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RawRouteErrorBoundary extends Component<RawRouteErrorBoundaryProps, RouteErrorBoundaryState> {
  constructor(props: RawRouteErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`RouteErrorBoundary caught an error in ${this.props.featureName || 'route'}`, error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.navigate('/');
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div 
          className="glass-panel" 
          style={{ 
            minHeight: '300px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '16px',
            padding: '24px',
            textAlign: 'center',
            margin: '20px auto',
            maxWidth: '500px',
            borderRadius: 'var(--radius-lg, 12px)'
          }}
        >
          <div style={{
            padding: '16px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: 'rgb(239, 68, 68)',
            display: 'inline-flex'
          }}>
            <AlertTriangle size={36} />
          </div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: "600", color: "var(--text-primary)" }}>
            This feature encountered an error
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: "1.5", maxWidth: "360px" }}>
            {this.state.error?.message || "An unexpected error occurred while loading this page."}
          </p>
          <button 
            onClick={this.handleReset}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '10px 20px', 
              backgroundColor: 'var(--accent-primary, #6366f1)', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer',
              fontWeight: "500",
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
              transition: 'all 0.2s ease'
            }}
          >
            <Home size={16} />
            Return to Dashboard
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export interface RouteErrorBoundaryProps {
  children?: ReactNode;
  featureName?: string;
}

export function RouteErrorBoundary({ children, featureName }: RouteErrorBoundaryProps) {
  const navigate = useNavigate();
  return (
    <RawRouteErrorBoundary navigate={navigate} featureName={featureName}>
      {children}
    </RawRouteErrorBoundary>
  );
}
