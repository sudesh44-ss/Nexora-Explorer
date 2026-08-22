import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '30px',
          color: '#f8fafc',
          background: '#020710',
          height: '100vh',
          fontFamily: 'Consolas, monospace',
          boxSizing: 'border-box',
          overflow: 'auto'
        }}>
          <h2 style={{ color: '#ff4d4d', marginTop: 0 }}>🚨 React Application Crashed</h2>
          <p style={{ fontSize: '16px', fontWeight: 'bold', background: 'rgba(255, 77, 77, 0.1)', padding: '10px', borderRadius: '4px', borderLeft: '4px solid #ff4d4d' }}>
            {this.state.error?.toString()}
          </p>
          <h3>Stack Trace:</h3>
          <pre style={{
            background: 'rgba(255,255,255,0.03)',
            padding: '15px',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.08)',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            fontSize: '13px',
            lineHeight: '1.5'
          }}>
            {this.state.error?.stack}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              padding: '10px 20px',
              background: '#0078d4',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              marginTop: '15px',
              transition: 'background 0.2s'
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
