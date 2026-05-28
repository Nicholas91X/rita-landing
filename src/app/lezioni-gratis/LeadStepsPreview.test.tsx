// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const { mockGetPreview } = vi.hoisted(() => ({ mockGetPreview: vi.fn() }))
vi.mock('@/app/actions/lead', () => ({
  getLeadPackagePreview: mockGetPreview,
}))
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} />
  },
}))

import LeadStepsPreview from './LeadStepsPreview'

describe('LeadStepsPreview', () => {
  it('renders heading and 3 placeholder slots when no videos', async () => {
    mockGetPreview.mockResolvedValue([])
    const ui = await LeadStepsPreview()
    const { container } = render(ui)
    expect(screen.getByText('Tre passi verso il benessere')).toBeInTheDocument()
    expect(container.querySelectorAll('.aspect-video').length).toBe(3)
  })

  it('renders thumbnails when videos are present', async () => {
    mockGetPreview.mockResolvedValue([
      { id: 'v1', title: 'A', bunny_video_id: 'b1' },
      { id: 'v2', title: 'B', bunny_video_id: 'b2' },
      { id: 'v3', title: 'C', bunny_video_id: 'b3' },
    ])
    const ui = await LeadStepsPreview()
    render(ui)
    const imgs = screen.getAllByRole('img')
    expect(imgs.length).toBe(3)
    expect(imgs[0]).toHaveAttribute('src', '/api/bunny-thumbnail/b1')
  })
})
