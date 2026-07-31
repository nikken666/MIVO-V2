import Link from "next/link";

export default function Footer() {
  return (
    <footer className="siteFooter">
      <div className="container footerGrid">
        <div>
          <img
            src="/mivo-logo.png"
            alt="MIVO"
            className="footerLogo"
          />

          <p>
            Find the right parts. Buy with confidence. Drive with safety.
          </p>
        </div>

        <div>
          <h4>Customer Care</h4>
          <Link href="/#help">Help Centre</Link>
          <Link href="/#shipping">Shipping</Link>
          <Link href="/#returns">Returns</Link>
        </div>

        <div>
          <h4>MIVO</h4>
          <Link href="/sellers">Seller Centre</Link>
          <Link href="/#services">Partner Garages</Link>
          <Link href="/#about">About Us</Link>
        </div>

        <div>
          <h4>Secure Payment</h4>
          <p>FPX · Cards · E-Wallet</p>
          <p>Buyer protection included</p>
        </div>
      </div>

      <div className="container copyright">
        © 2026 MIVO BY NIKKEN MARKETING SDN BHD All rights reserved.
      </div>
    </footer>
  );
}