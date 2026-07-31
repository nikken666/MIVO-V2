import Link from "next/link";
import VehicleFinder from "../components/VehicleFinder";
import SearchPanel from "../components/SearchPanel";
import ProductCard from "../components/ProductCard";
import { products } from "../data/products";

const categories = [["🛢️","Maintenance"],["⚙️","Engine"],["🔩","Suspension"],["🛞","Braking"],["◉","Steering"],["▦","Cooling"],["🔋","Electrical"],["◒","Body Parts"],["💺","Interior"],["🧰","Tools & Garage"],["◉","Tyres & Wheels"],["▦","View All"]];
const benefits = [["✓","100% Fitment Guarantee","Right part for your vehicle"],["◇","Genuine & Quality Parts","Trusted brands only"],["▱","Fast Delivery","Nationwide shipping"],["▣","Secure Payment","Multiple payment options"],["⌘","Install at Partner Garages","700+ workshops nationwide"]];

export default function HomePage() {
  return <main>
    <VehicleFinder />
    <SearchPanel />
    <section id="categories" className="container categoryPanel">{categories.map(([icon,label]) => <Link href={label === "View All" ? "/products" : `/products?category=${encodeURIComponent(label)}`} className="categoryItem" key={label}><span className="categoryGraphic">{icon}</span><span>{label}</span></Link>)}</section>
    <section id="deals" className="container homeGrid">
      <div className="mainColumn">
        <div className="heroBanner"><div className="heroCopy"><span className="dealTag">UP TO</span><h1>50% OFF</h1><h2>SHOCK ABSORBER</h2><p>Drive Safe, Drive Confident</p><Link href="/products?category=Suspension" className="redButton heroButton">Shop Now →</Link></div><div className="heroParts" aria-hidden="true"><span className="shock shockOne">╱│╲</span><span className="shock shockTwo">╱│╲</span></div><img className="heroMascot" src="/mivo-ip.png" alt="MIVO automotive assistant" /><div className="sliderDots"><i></i><i></i><i></i><i></i></div></div>
        <div className="sectionTitle"><h2>RECOMMENDED FOR YOU</h2><Link href="/products">View All</Link></div>
        <div className="productRow">{products.slice(0,6).map((product) => <ProductCard product={product} compact key={product.slug} />)}</div>
      </div>
      <aside className="sideColumn"><div className="benefitCard"><h2>WHY CHOOSE MIVO?</h2>{benefits.map(([icon,title,desc]) => <div className="benefit" key={title}><span>{icon}</span><div><strong>{title}</strong><small>{desc}</small></div></div>)}</div><div id="services" className="serviceCard"><div><h2>BOOK SERVICE</h2><h3>AT PARTNER GARAGE</h3><p>Professional installation<br />Nationwide</p><Link href="/services" className="lightButton">Book Now →</Link></div><img src="/mivo-ip.png" alt="MIVO partner garage assistant" /></div></aside>
    </section>
    <section className="container promiseStrip"><div><span>🚘</span><strong>Find Right Parts</strong><small>Select your vehicle and we’ll show you the right parts</small></div><div><span>◇</span><strong>Wide Selection</strong><small>100,000+ products from trusted brands</small></div><div><span>🏷</span><strong>Best Prices</strong><small>Competitive prices everyday</small></div><div><span>◉</span><strong>Expert Support</strong><small>Our team is here to help you</small></div><div><span>↻</span><strong>Easy Returns</strong><small>7 days return policy, T&amp;C apply</small></div></section>
  </main>;
}
