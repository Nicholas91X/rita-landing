// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import LeadTestimonials from './LeadTestimonials'

describe('LeadTestimonials', () => {
  it('renders the 3 testimonials with names', () => {
    render(<LeadTestimonials />)
    expect(screen.getByText('Federica B.')).toBeInTheDocument()
    expect(screen.getByText('Asia R.')).toBeInTheDocument()
    expect(screen.getByText('Teresa B.')).toBeInTheDocument()
  })

  it('applies bold spans to selected phrases', () => {
    const { container } = render(<LeadTestimonials />)
    const bolds = container.querySelectorAll('strong')
    // "menopausa" in heading + at least one bold per testimonial
    expect(bolds.length).toBeGreaterThan(3)
    // verify one of the highlighted phrases is bolded somewhere
    expect(
      Array.from(bolds).some((el) =>
        el.textContent?.includes('fatto pace con lo specchio'),
      ),
    ).toBe(true)
  })
})
