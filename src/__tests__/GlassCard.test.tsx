// @vitest-environment jsdom
/**
 * GlassCard 组件测试
 *
 * 覆盖：默认渲染、variant 变体、自定义 className、onClick 回调、
 * 键盘可访问性（Enter/Space）、无 onClick 时的可访问性属性。
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GlassCard from '../ui/components/GlassCard'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('GlassCard 渲染', () => {
  it('默认 variant=default 渲染 children', () => {
    render(<GlassCard>Hello World</GlassCard>)
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('variant=strong 添加 glass-strong class', () => {
    render(<GlassCard variant="strong">Strong</GlassCard>)
    const card = screen.getByText('Strong')
    expect(card).toHaveClass('glass-strong')
  })

  it('variant=subtle 添加 glass-subtle class', () => {
    render(<GlassCard variant="subtle">Subtle</GlassCard>)
    const card = screen.getByText('Subtle')
    expect(card).toHaveClass('glass-subtle')
  })

  it('自定义 className 追加到 variant class 之后', () => {
    render(<GlassCard className="custom-class">Custom</GlassCard>)
    const card = screen.getByText('Custom')
    expect(card).toHaveClass('glass')
    expect(card).toHaveClass('custom-class')
  })
})

describe('GlassCard onClick', () => {
  it('点击触发 onClick 回调', () => {
    const onClick = vi.fn()
    render(<GlassCard onClick={onClick}>Clickable</GlassCard>)
    fireEvent.click(screen.getByText('Clickable'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('有 onClick 时 role=button 且 tabIndex=0', () => {
    render(<GlassCard onClick={() => {}}>Accessible</GlassCard>)
    const card = screen.getByRole('button')
    expect(card).toBeInTheDocument()
    expect(card).toHaveAttribute('tabindex', '0')
  })

  it('无 onClick 时没有 role 和 tabIndex', () => {
    render(<GlassCard>Not Clickable</GlassCard>)
    const card = screen.getByText('Not Clickable')
    expect(card).not.toHaveAttribute('role')
    expect(card).not.toHaveAttribute('tabindex')
  })
})

describe('GlassCard 键盘可访问性', () => {
  it('按 Enter 触发 onClick', () => {
    const onClick = vi.fn()
    render(<GlassCard onClick={onClick}>Keyboard</GlassCard>)
    const card = screen.getByRole('button')
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('按 Space 触发 onClick', () => {
    const onClick = vi.fn()
    render(<GlassCard onClick={onClick}>Keyboard</GlassCard>)
    const card = screen.getByRole('button')
    fireEvent.keyDown(card, { key: ' ' })
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('按其他键不触发 onClick', () => {
    const onClick = vi.fn()
    render(<GlassCard onClick={onClick}>Keyboard</GlassCard>)
    const card = screen.getByRole('button')
    fireEvent.keyDown(card, { key: 'Escape' })
    expect(onClick).not.toHaveBeenCalled()
  })
})
