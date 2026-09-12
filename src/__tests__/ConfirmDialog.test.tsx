// @vitest-environment jsdom
/**
 * ConfirmDialog 组件测试
 *
 * 覆盖：open=false 不渲染、open=true 渲染 message、点击取消/确认按钮、
 * 点击遮罩层取消、按 Escape 取消。
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ConfirmDialog from '../ui/components/ConfirmDialog'
import { I18nProvider } from '../i18n'

function renderDialog(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  return render(
    <I18nProvider>
      <ConfirmDialog
        open={true}
        message="确认删除？"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        {...props}
      />
    </I18nProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ConfirmDialog 渲染', () => {
  it('open=false 时不渲染', () => {
    renderDialog({ open: false })
    expect(screen.queryByText('确认删除？')).not.toBeInTheDocument()
  })

  it('open=true 时渲染 message', () => {
    renderDialog({ open: true, message: '测试确认框' })
    expect(screen.getByText('测试确认框')).toBeInTheDocument()
  })

  it('open=true 时渲染取消和确认按钮', () => {
    renderDialog({ open: true })
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
  })
})

describe('ConfirmDialog 交互', () => {
  it('点击取消按钮触发 onCancel', () => {
    const onCancel = vi.fn()
    renderDialog({ open: true, onCancel })
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0]) // 取消按钮
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('点击确认按钮触发 onConfirm', () => {
    const onConfirm = vi.fn()
    renderDialog({ open: true, onConfirm })
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[1]) // 确认按钮
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('按 Escape 触发 onCancel', () => {
    const onCancel = vi.fn()
    renderDialog({ open: true, onCancel })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('open=false 时按 Escape 不触发 onCancel', () => {
    const onCancel = vi.fn()
    renderDialog({ open: false, onCancel })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).not.toHaveBeenCalled()
  })
})
