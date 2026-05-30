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

import LeadStepsPreview from './LeadStepsPreview'

describe('LeadStepsPreview', () => {
  it('renders the heading and 3 static brand thumbnails', () => {
    render(<LeadStepsPreview />)
    expect(screen.getByText('Tre passi verso il benessere')).toBeInTheDocument()

    const imgs = screen.getAllByRole('img')
    expect(imgs.length).toBe(3)
    expect(imgs[0]).toHaveAttribute('src', '/lead-magnet/thumbnail-1.jpg')
    expect(imgs[1]).toHaveAttribute('src', '/lead-magnet/thumbnail-2.jpg')
    expect(imgs[2]).toHaveAttribute('src', '/lead-magnet/thumbnail-3.jpg')
  })
})
