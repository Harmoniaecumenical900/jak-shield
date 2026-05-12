async function getRedactions() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SHIELD_API ?? 'http://localhost:4100'}/api/audit?action=PII_REDACTED&limit=200`,
    { cache: 'no-store' },
  );
  const a = await res.json();
  const res2 = await fetch(
    `${process.env.NEXT_PUBLIC_SHIELD_API ?? 'http://localhost:4100'}/api/audit?action=PII_DETECTED&limit=200`,
    { cache: 'no-store' },
  );
  const b = await res2.json();
  return [...(a as unknown[]), ...(b as unknown[])] as { id: string; resource?: string; details: Record<string, unknown>; timestamp: string }[];
}

export default async function RedactionsPage() {
  const items = await getRedactions();
  return (
    <div>
      <h1>Redactions</h1>
      <p className="muted">PII / secrets that JAK Shield masked before they reached an external system. Original values are not stored.</p>
      {items.length === 0 ? (
        <div className="empty">No redactions yet.</div>
      ) : (
        <table>
          <thead><tr><th>Time</th><th>Tool</th><th>Findings</th></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>{new Date(it.timestamp).toLocaleString()}</td>
                <td><code>{it.resource ?? '—'}</code></td>
                <td><pre style={{ margin: 0 }}>{JSON.stringify(it.details)}</pre></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
