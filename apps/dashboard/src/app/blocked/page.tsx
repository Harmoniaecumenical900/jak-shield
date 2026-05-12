async function getBlocked() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SHIELD_API ?? 'http://localhost:4100'}/api/audit?action=TOOL_CALL_BLOCKED&limit=200`,
    { cache: 'no-store' },
  );
  return res.json() as Promise<{ id: string; resource?: string; details: Record<string, unknown>; timestamp: string }[]>;
}

export default async function BlockedPage() {
  const items = await getBlocked();
  return (
    <div>
      <h1>Blocked actions</h1>
      <p className="muted">Tool calls that the policy engine refused. Counts include classifier escalations.</p>
      {items.length === 0 ? (
        <div className="empty">Nothing has been blocked.</div>
      ) : (
        <table>
          <thead>
            <tr><th>Time</th><th>Tool</th><th>Reason</th></tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>{new Date(it.timestamp).toLocaleString()}</td>
                <td><code>{it.resource ?? '—'}</code></td>
                <td>{String((it.details as { reason?: string }).reason ?? '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
