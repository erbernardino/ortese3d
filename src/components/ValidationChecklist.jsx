export function ValidationChecklist({ result }) {
  if (!result) {
    return <p style={{ color: '#a0aec0', fontSize: 14 }}>Nenhuma validação executada ainda.</p>
  }

  return (
    <div>
      <div style={{ marginBottom: 12, fontSize: 18 }}>
        {result.is_valid
          ? <span style={{ color: '#48c78e' }}>✅ Modelo válido</span>
          : <span style={{ color: '#fc8181' }}>❌ Modelo com erros</span>
        }
      </div>

      {result.errors?.length > 0 && (
        <ul style={{ color: '#fc8181', fontSize: 13, paddingLeft: 20 }}>
          {result.errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}

      {result.warnings?.length > 0 && (
        <ul style={{ color: '#ffa032', fontSize: 13, paddingLeft: 20 }}>
          {result.warnings.map((w, i) => <li key={i}>⚠️ {w}</li>)}
        </ul>
      )}

      <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.8 }}>
        <div>Volume: {result.volume_cm3} cm³</div>
        <div>Peso estimado: {result.weight_g} g</div>
      </div>
    </div>
  )
}
