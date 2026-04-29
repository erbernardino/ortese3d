const ZONES = [
  { id: 'relief', label: 'Alívio', color: '#63b3ed', description: 'Sem pressão' },
  { id: 'pressure', label: 'Pressão', color: '#fc8181', description: 'Contato controlado' },
  { id: 'neutral', label: 'Neutro', color: '#a0aec0', description: 'Normal' },
]

export function ZonePainter({ activeZone, onZoneChange, thickness, onThicknessChange }) {
  return (
    <div>
      <h4 style={{ margin: '16px 0 8px', fontSize: 13, textTransform: 'uppercase', opacity: 0.6 }}>Zonas</h4>
      {ZONES.map(zone => (
        <button
          key={zone.id}
          onClick={() => onZoneChange(zone.id)}
          style={{
            display: 'block', width: '100%', marginBottom: 6,
            padding: '8px 12px', textAlign: 'left', borderRadius: 8,
            background: activeZone === zone.id ? zone.color + '22' : 'transparent',
            border: `2px solid ${activeZone === zone.id ? zone.color : '#333'}`,
            color: zone.color, cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          <strong style={{ display: 'block', fontSize: 13 }}>{zone.label}</strong>
          <span style={{ fontSize: 11, opacity: 0.7 }}>{zone.description}</span>
        </button>
      ))}

      <h4 style={{ margin: '16px 0 8px', fontSize: 13, textTransform: 'uppercase', opacity: 0.6 }}>Espessura da parede</h4>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="range" min="2" max="6" step="0.5"
          value={thickness}
          onChange={e => onThicknessChange(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ minWidth: 32, fontSize: 13 }}>{thickness}mm</span>
      </div>
    </div>
  )
}
