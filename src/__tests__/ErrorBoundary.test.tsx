// @vitest-environment jsdom
/**
 * ErrorBoundary 组件测试
 *
 * 覆盖：正常渲染 children、子组件抛错时显示 fallback、自定义 fallback、
 * componentDidCatch 被调用。
 */
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ErrorBoundary from '../ui/components/ErrorBoundary'
import { I18nProvider } from '../i18n'

function renderWithI18n(ui: React.ReactNode) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

function Bomb({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) throw new Error('💥 Boom!')
  return <div>Safe</div>
}

describe('ErrorBoundary 正常渲染', () => {
  it('无错误时渲染 children', () => {
    renderWithI18n(
      <ErrorBoundary>
        <div>Hello World</div>
      </ErrorBoundary>,
    )
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('子组件不抛错时正常渲染', () => {
    renderWithI18n(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Safe')).toBeInTheDocument()
  })
})

describe('ErrorBoundary 错误捕获', () => {
  it('子组件抛错时显示默认 ErrorFallback', () => {
    // 抑制 console.error 输出（测试预期会抛错）
    vi.spyOn(console, 'error').mockImplementation(() => {})

    renderWithI18n(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )

    // 默认 fallback 应该显示 ErrorFallback（包含 "Nymir" 标题）
    expect(screen.getByRole('heading', { name: 'Nymir' })).toBeInTheDocument()
  })

  it('子组件抛错时不渲染 children', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    renderWithI18n(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )

    // 抛错的子组件内容不应该出现
    expect(screen.queryByText('💥 Boom!')).not.toBeInTheDocument()
  })

  it('自定义 fallback 在子组件抛错时显示', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    renderWithI18n(
      <ErrorBoundary fallback={<div>Custom Fallback</div>}>
        <Bomb />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Custom Fallback')).toBeInTheDocument()
  })

  it('componentDidCatch 被调用并记录错误', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    renderWithI18n(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )

    expect(consoleError).toHaveBeenCalled()
    // 检查所有参数中是否包含 '[Nymir] Runtime error:'（React 会包装格式化字符串）
    const allArgs = consoleError.mock.calls.flat().join(' ')
    expect(allArgs).toContain('[Nymir] Runtime error:')
  })
})
