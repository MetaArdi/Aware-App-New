import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow border border-outline-variant p-8 max-w-md w-full text-center space-y-4">
            <div className="text-5xl">⚠️</div>
            <h2 className="text-headline-md text-on-background">Terjadi Kesalahan</h2>
            <p className="text-body-sm text-on-surface-variant">
              Aplikasi mengalami error yang tidak terduga. Silakan muat ulang halaman.
            </p>
            <pre className="text-xs text-left bg-surface-container-low p-3 rounded-lg overflow-auto max-h-32 text-error">
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="bg-secondary text-on-secondary px-6 py-2.5 rounded-xl font-semibold hover:opacity-90 transition"
            >
              Muat Ulang
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}