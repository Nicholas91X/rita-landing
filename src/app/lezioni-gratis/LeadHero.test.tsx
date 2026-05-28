// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} />
  },
}))

import LeadHero from './LeadHero'

describe('LeadHero', () => {
  it('renders the headline and CTA anchor', () => {
    render(<LeadHero />)
    expect(screen.getByText(/Non siamo qui/i)).toBeInTheDocument()
    expect(screen.getByText(/Siamo qui per/i)).toBeInTheDocument()
    expect(screen.getByText(/rinascere/i)).toBeInTheDocument()
    const cta = screen.getByRole('link', { name: /inizia il tuo viaggio gratuito/i })
    expect(cta).toHaveAttribute('href', '#form')
  })
})
