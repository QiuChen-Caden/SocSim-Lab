import React from 'react'

type Props = {
  title?: string
  onReset?: () => void
  children: React.ReactNode
}

type State = { error: Error | null }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch() {
    // 保持默认行为（稍后可以添加遥测） keep default behavior (we can add telemetry later)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="panel" style={{ height: '100%' }}>
        <div className="panel__hd">
          <div className="panel__title">{this.props.title ?? 'Render Error'}</div>
          <button
            className="btn btn--primary"
            onClick={() => {
              this.setState({ error: null })
              this.props.onReset?.()
            }}
          >
            Retry
          </button>
        </div>
        <div className="panel__bd">
          <div className="muted" style={{ marginBottom: 8 }}>
            组件渲染失败，但应用不应整体崩溃。请点击 Retry 重新挂载。
          </div>
          <div className="logline logline--error">
            <div>{this.state.error.name}: {this.state.error.message}</div>
          </div>
        </div>
      </div>
    )
  }
}

