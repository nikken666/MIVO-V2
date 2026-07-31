export type Product = {
  slug: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  reviews: number;
  icon: string;
  description: string;
};

export const products: Product[] = [
  { slug: "kyb-excel-g-front-absorber-set", name: "KYB Excel-G Front Absorber Set", brand: "KYB", category: "Suspension", price: 248, reviews: 128, icon: "🔩", description: "Front shock absorber set designed for stable handling and daily driving comfort." },
  { slug: "nikken-front-brake-pad", name: "NIKKEN Brake Pad (Front)", brand: "NIKKEN", category: "Braking", price: 89, reviews: 96, icon: "▰", description: "Low-noise front brake pad set with dependable stopping performance." },
  { slug: "gsp-drive-shaft-rh", name: "GSP Drive Shaft (RH)", brand: "GSP", category: "Drivetrain", price: 320, reviews: 74, icon: "⚙️", description: "Complete right-hand drive shaft assembly for selected vehicle applications." },
  { slug: "denso-iridium-spark-plug", name: "DENSO Iridium Spark Plug", brand: "DENSO", category: "Engine", price: 28, reviews: 187, icon: "✦", description: "Iridium spark plug for responsive ignition and consistent engine performance." },
  { slug: "aisin-water-pump", name: "AISIN Water Pump", brand: "AISIN", category: "Cooling", price: 205, reviews: 64, icon: "◉", description: "Engine cooling water pump manufactured for reliable circulation and durability." },
  { slug: "shell-helix-hx7-5w30", name: "Shell Helix HX7 5W-30 (4L)", brand: "SHELL", category: "Maintenance", price: 125, reviews: 112, icon: "🛢️", description: "Semi-synthetic engine oil for everyday protection and cleaner engine operation." },
  { slug: "nikken-long-life-coolant", name: "NIKKEN Long Life Coolant Premixed 2L", brand: "NIKKEN", category: "Cooling", price: 18.9, reviews: 221, icon: "🧴", description: "Premixed long-life coolant for convenient top-up and cooling-system protection." },
  { slug: "vortex-sport-disc-rotor", name: "VORTEX Sport Disc Rotor Front Pair", brand: "VORTEX", category: "Braking", price: 299, reviews: 58, icon: "🛞", description: "Sport-style front disc rotor pair with a performance-inspired finish." },
  { slug: "portable-jump-starter", name: "Portable Jump Starter 12000mAh", brand: "MIVO TECH", category: "Electrical", price: 159, reviews: 84, icon: "🔋", description: "Compact emergency jump starter with USB power-bank functionality." },
  { slug: "smart-dash-cam", name: "Smart Dash Cam Full HD Night Vision", brand: "MIVO TECH", category: "Electrical", price: 129, reviews: 93, icon: "📷", description: "Full-HD dashboard camera with night-vision support for everyday road recording." },
  { slug: "lower-arm-ball-joint-set", name: "Complete Lower Arm Set With Ball Joint", brand: "NIKKEN", category: "Suspension", price: 149, reviews: 141, icon: "🧰", description: "Complete lower-arm set supplied with ball joints for selected models." },
  { slug: "led-headlamp-kit", name: "LED Headlamp Conversion Kit 6000K", brand: "MIVO", category: "Electrical", price: 45.9, reviews: 110, icon: "💡", description: "Bright white LED conversion kit for compatible headlamp applications." },
];

export function formatPrice(value: number) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(value);
}
