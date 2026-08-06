import { useEffect, useState } from 'react'
import './DeploymentBanner.css'

const allowedLabels = new Set(['STAGING', 'PRE-LAUNCH DEMO'])

export function DeploymentBanner() {
  const [label, setLabel] = useState('')

  useEffect(() => {
    let active = true

    void fetch('/api/deployment-info', { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) throw new Error('Deployment information unavailable')
        return response.json() as Promise<{ environment_label?: unknown }>
      })
      .then((payload) => {
        if (
          active &&
          typeof payload.environment_label === 'string' &&
          allowedLabels.has(payload.environment_label)
        ) {
          setLabel(payload.environment_label)
        }
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [])

  if (!label) return null

  return (
    <div className="deployment-banner" role="status">
      {label}
    </div>
  )
}
