// Logo roket VentureGo dengan cincin orbit dan tiga satelit yang mengitarinya.
// Dipakai di hero halaman awal dan di layar loading (RocketLoader).

type OrbitMarkProps = {
  /** Teks alternatif logo. Kosongkan bila logo hanya dekorasi. */
  label?: string
  /** Versi lebih kecil untuk layar loading. */
  compact?: boolean
}

export function OrbitMark({ label, compact = false }: OrbitMarkProps) {
  return (
    <div className={`orbit-system${compact ? ' orbit-system--compact' : ''}`}>
      <img
        className="orbit-logo"
        src="/venturego-mark.svg"
        alt={label ?? ''}
        aria-hidden={label ? undefined : true}
        width={24}
        height={23}
      />
      <span className="orbit-sat orbit-sat--yellow" aria-hidden="true" />
      <span className="orbit-sat orbit-sat--red" aria-hidden="true" />
      <span className="orbit-sat orbit-sat--green" aria-hidden="true" />
    </div>
  )
}

export function RocketLoader({ message }: { message: string }) {
  return (
    <div className="rocket-loader" role="status" aria-live="polite">
      <OrbitMark compact />
      <p>{message}</p>
    </div>
  )
}
