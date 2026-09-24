import Link from "next/link";
import styles from "../Admin.module.css";

export default function AdminFitmentPage() {
  return (
    <main className={styles.adminShell}>
      <div className="container">
        <div className={styles.adminTop}>
          <div>
            <span className={styles.adminEyebrow}>MIVO ADMIN · FITMENT</span>
            <h1>Fitment Manager</h1>
            <p>Connect products to exact vehicle generations, years, variants and transmissions.</p>
          </div>
          <Link href="/admin/products" className={styles.adminSecondary}>PRODUCTS</Link>
        </div>
        <nav className={styles.adminNav}>
          <Link href="/admin">Dashboard</Link><Link href="/admin/products">Products</Link><Link href="/admin/products/new">Add Product</Link><Link href="/admin/fitment">Fitment</Link><Link href="/admin/orders">Orders</Link><Link href="/admin/sellers">Sellers</Link>
        </nav>
        <section className={styles.adminPanel}>
          <div className={styles.adminPanelHead}><div><h2>Vehicle Fitment</h2><p>Next module: select a product, then assign Make → Model → Generation → Year → Variant → Transmission.</p></div></div>
          <p className={styles.adminNotice}>The matching engine is already connected on the storefront. This page will become the admin editor for that data.</p>
        </section>
      </div>
    </main>
  );
}
