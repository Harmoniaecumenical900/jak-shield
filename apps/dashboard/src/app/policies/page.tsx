async function getPolicies() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SHIELD_API ?? 'http://localhost:4100'}/api/policies`, { cache: 'no-store' });
  return res.json() as Promise<{ name: string; description: string; enabled: boolean }[]>;
}

export default async function PoliciesPage() {
  const policies = await getPolicies();
  return (
    <div>
      <h1>Policies</h1>
      <p className="muted">Built-in deterministic rules. Custom YAML rules per tenant coming next.</p>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {policies.map((p) => (
            <tr key={p.name}>
              <td><code>{p.name}</code></td>
              <td>{p.description}</td>
              <td>
                <span className={`badge ${p.enabled ? 'badge-allow' : 'badge-block'}`}>
                  {p.enabled ? 'enabled' : 'disabled'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
