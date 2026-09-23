type LogoVariant = "dark" | "light" | "watermark";

export default function Logo({
  variant = "dark",
  className = "",
  decorative = false,
}: {
  variant?: LogoVariant;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <span className={`mivoLogo mivoLogo--${variant} ${className}`.trim()}>
      <img
        src="/mivo-logo.png"
        alt={decorative ? "" : "MIVO"}
        aria-hidden={decorative ? true : undefined}
      />
    </span>
  );
}
