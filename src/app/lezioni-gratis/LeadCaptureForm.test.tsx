// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

const { mockRequest, toastError } = vi.hoisted(() => ({
  mockRequest: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/app/actions/lead', () => ({ requestLeadMagicLink: mockRequest }))
vi.mock('sonner', () => ({
  toast: { error: toastError, success: vi.fn() },
}))
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} />
  },
}))

import LeadCaptureForm from './LeadCaptureForm'

describe('LeadCaptureForm', () => {
  beforeEach(() => {
    mockRequest.mockReset()
    toastError.mockReset()
  })
  afterEach(() => cleanup())

  it('shows validation errors when submitted empty', async () => {
    render(<LeadCaptureForm />)
    fireEvent.click(screen.getByRole('button', { name: /inizia il tuo viaggio/i }))
    await waitFor(() => {
      expect(screen.getByText(/nome troppo corto/i)).toBeInTheDocument()
    })
    expect(mockRequest).not.toHaveBeenCalled()
  })

  it('submits and shows success state on ok=true', async () => {
    mockRequest.mockResolvedValue({ ok: true })
    const { container } = render(<LeadCaptureForm />)

    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: 'Mario Rossi' },
    })
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'mario@example.com' },
    })
    const termsCheckbox = container.querySelector(
      'input[name="terms_accepted"]',
    ) as HTMLInputElement
    fireEvent.click(termsCheckbox)
    fireEvent.click(screen.getByRole('button', { name: /inizia il tuo viaggio/i }))

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalled()
    })
    const fd = mockRequest.mock.calls[0][0] as FormData
    expect(fd.get('full_name')).toBe('Mario Rossi')
    expect(fd.get('email')).toBe('mario@example.com')
    expect(fd.get('terms_accepted')).toBe('on')
    expect(fd.get('lead_source')).toBe('landing')

    await waitFor(() => {
      expect(screen.getByText(/controlla la tua email/i)).toBeInTheDocument()
    })
  })

  it('shows toast error when server returns ok=false', async () => {
    mockRequest.mockResolvedValue({ ok: false, message: 'Troppe richieste' })
    const { container } = render(<LeadCaptureForm />)

    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: 'Mario' },
    })
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'm@e.com' },
    })
    const termsCheckbox = container.querySelector(
      'input[name="terms_accepted"]',
    ) as HTMLInputElement
    fireEvent.click(termsCheckbox)
    fireEvent.click(screen.getByRole('button', { name: /inizia il tuo viaggio/i }))

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Troppe richieste')
    })
    // success state should NOT render
    expect(screen.queryByText(/controlla la tua email/i)).not.toBeInTheDocument()
  })
})
