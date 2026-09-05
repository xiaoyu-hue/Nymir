import { Component, type ReactNode } from 'react'
import ErrorFallback from './ErrorFallback'

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
      return this.props.fallback ?? <ErrorFallback />
    }
    return this.props.children
  }
}
