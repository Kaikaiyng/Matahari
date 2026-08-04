import { School } from 'lucide-react'
import { productBrand } from '../branding'
import './BrandMark.css'

export function BrandMark({ className = '', size = 28 }: { className?: string; size?: number }) {
  return (
    <span className={`brand-mark ${className}`.trim()} role="img" aria-label={productBrand.logoLabel}>
      <School size={size} aria-hidden="true" />
    </span>
  )
}
