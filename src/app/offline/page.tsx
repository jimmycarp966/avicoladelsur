import Link from 'next/link'

export const dynamic = 'force-static'

export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        background: '#F9FBFA',
        padding: '24px',
        color: '#1F2937',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '28rem',
          borderRadius: '24px',
          border: '1px solid rgba(47, 112, 88, 0.14)',
          background: '#ffffff',
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.08)',
          padding: '32px 24px',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(47, 112, 88, 0.1)',
            color: '#2F7058',
            fontSize: '28px',
            marginBottom: '20px',
          }}
          aria-hidden="true"
        >
          !
        </div>

        <p
          style={{
            margin: 0,
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#2F7058',
          }}
        >
          Avicola del Sur ERP
        </p>

        <h1
          style={{
            margin: '10px 0 12px',
            fontSize: 'clamp(1.8rem, 5vw, 2.5rem)',
            lineHeight: 1.05,
            color: '#0F172A',
          }}
        >
          No hay conexion
        </h1>

        <p
          style={{
            margin: 0,
            fontSize: '1rem',
            lineHeight: 1.6,
            color: '#475569',
          }}
        >
          La app sigue instalada, pero necesita red para cargar datos nuevos. Cuando vuelva la
          conexion, podes reintentar desde esta pantalla.
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            marginTop: '28px',
          }}
        >
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '44px',
              padding: '0 18px',
              borderRadius: '14px',
              background: '#2F7058',
              color: '#ffffff',
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            Reintentar
          </Link>
          <Link
            href="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '44px',
              padding: '0 18px',
              borderRadius: '14px',
              border: '1px solid rgba(47, 112, 88, 0.2)',
              background: '#ffffff',
              color: '#2F7058',
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            Ir al login
          </Link>
        </div>
      </section>
    </main>
  )
}
