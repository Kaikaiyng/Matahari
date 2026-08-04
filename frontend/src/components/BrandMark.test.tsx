import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { productBrand } from '../branding'
import { BrandMark } from './BrandMark'

describe('neutral product brand', () => {
  it('exposes the approved demo identity', () => {
    expect(productBrand).toMatchObject({
      productName: 'School Admin System',
      demoOrganizationName: 'Demo International School',
      receiptDisclaimer: 'SAMPLE — NOT A VALID RECEIPT',
    })
  })

  it('renders an accessible generic mark without a school image', () => {
    render(<BrandMark />)
    expect(screen.getByRole('img', { name: 'School Admin System logo' })).toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
  })
})
