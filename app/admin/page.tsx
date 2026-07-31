const stats = [["Total Orders", "1,284"], ["GMV", "RM 248,930"], ["Active Sellers", "18"], ["Products", "4,592"]];
export default function AdminPage() {
  return (
    <main className="container pageShell">
      <div className="sectionTitle"><h2>MIVO ADMIN DASHBOARD</h2></div>
      <div className="adminGrid">{stats.map(([label, value]) => <div className="statCard" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <div className="contentPanel adminModules"><h3>Admin Modules</h3><p>Orders · Products · Sellers · Customers · Payments · Shipping · Commission · Disputes · Reports</p></div>
    </main>
  );
}
