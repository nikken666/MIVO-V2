import Link from "next/link";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="siteFooter">
      <div className="container footerTop">
        <div className="footerBrandBlock">
          <Logo variant="dark" className="footerLogoAsset" />
          <p>Premium automotive parts, matched with more confidence.</p>
        </div>
        <div><h4>SHOP</h4><Link href="/products">All Parts</Link><Link href="/brands">Brands</Link><Link href="/garage">My Garage</Link></div>
        <div><h4>SUPPORT</h4><Link href="/orders">Track Order</Link><Link href="/account">My Account</Link><Link href="/shipping-policy">Shipping Policy</Link><Link href="/returns-policy">Returns &amp; Refunds</Link><Link href="/privacy-policy">Privacy Policy</Link></div>
        <div><h4>MIVO</h4><Link href="/#fitment">Vehicle Match</Link><Link href="/#standard">Our Standard</Link></div>
      </div>
      <div className="container footerBottom">
        <span>© 2026 MIVO. All rights reserved.</span>
        <span>Secure payment · Malaysia delivery</span>
      </div>
    </footer>
  );
}