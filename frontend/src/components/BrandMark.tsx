import logoImg from '../assets/logo.jpeg'
import { productBrand } from '../branding'
import { useTenantConfiguration } from '../tenant'
import './BrandMark.css'

export function BrandMark({ className = '' }: { className?: string; size?: number }) {
  const tenant = useTenantConfiguration()
  return (
    <span className={`brand-mark ${className}`.trim()} role="img" aria-label={`${tenant.branding.organization_name || productBrand.organizationName} logo`}>
      <img src={tenant.branding.logo_url ?? logoImg} alt="" className="brand-mark-img" />
    </span>
  )
}
