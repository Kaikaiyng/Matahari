import logoImg from '../assets/logo.jpeg'
import { productBrand } from '../branding'
import './BrandMark.css'

export function BrandMark({ className = '' }: { className?: string; size?: number }) {
  return (
    <span className={`brand-mark ${className}`.trim()} role="img" aria-label={productBrand.logoLabel}>
      <img src={logoImg} alt="" className="brand-mark-img" />
    </span>
  )
}
