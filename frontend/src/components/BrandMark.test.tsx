import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { productBrand } from '../branding'
import { BrandMark } from './BrandMark'

describe('official product brand', () => {
  it('exposes the approved Matahari identity', () => {
    expect(productBrand).toMatchObject({
      productName: 'Matahari International School',
      demoOrganizationName: 'Matahari International School',
      receiptDisclaimer: 'SAMPLE — NOT A VALID RECEIPT',
    })
  })

  it('renders an accessible product mark with the official logo image', () => {
    render(<BrandMark />)
    expect(screen.getByRole('img', { name: 'Matahari International School logo' })).toBeInTheDocument()
    expect(document.querySelector('img')).not.toBeNull()
  })
})
