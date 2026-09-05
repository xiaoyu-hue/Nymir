import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode; fallback?: ReactNode }
type State = { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Nymir] Runtime error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100dvh', background: '#0a0a1a',
          color: 'rgba(255,255,255,0.7)', fontFamily: 'system-ui, sans-serif',
          textAlign: 'center', padding: '20px',
        }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>Nymir</h1>
          <p style={{ marginBottom: '16px' }}>应用发生错误</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 24px', borderRadius: '8px', border: '1px solid rgba(124,106,239,0.3)',
              background: 'rgba(124,106,239,0.2)', color: '#7c6aef', cursor: 'pointer',
            }}
          >
            重新加载
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
