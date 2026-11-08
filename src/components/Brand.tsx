export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="AtriaNutri">
      <span className="brand__mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {!compact && (
        <span className="brand__wordmark">
          <span>Atria<strong>Nutri</strong></span>
          <small>BY ATRIACARE</small>
        </span>
      )}
    </div>
  )
}
