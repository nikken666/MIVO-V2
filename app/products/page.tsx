const items = Array.from({ length: 15 }, (_, i) => ({
  title: ["Shock Absorber Set", "Drive Shaft Assembly", "Long Life Coolant", "Steering Rack", "Lower Arm Set"][i % 5],
  price: ["RM 168.00", "RM 239.00", "RM 18.90", "RM 399.00", "RM 149.00"][i % 5],
  icon: ["🔩", "⚙️", "🛢️", "◉", "🧰"][i % 5],
}));

export default function ProductsPage() {
  return (
    <main className="container pageShell">
      <div className="sectionTitle"><h2>ALL PRODUCTS</h2></div>
      <div className="catalogGrid">
        {items.map((item, i) => (
          <article className="catalogCard" key={`${item.title}-${i}`}>
            <div className="catalogImage">{item.icon}</div>
            <h3>{item.title}</h3>
            <span>Verified MIVO Seller</span>
            <strong>{item.price}</strong>
            <small>★★★★★ · {100 + i * 17} sold</small>
          </article>
        ))}
      </div>
    </main>
  );
}
