type LogoVariant = "dark" | "light" | "watermark";

const logoSources: Record<LogoVariant, string> = {
  dark: "/mivo-logo-dark.svg",
  light: "/mivo-logo-light.svg",
  watermark: "/mivo-logo-watermark.svg",
};

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
        src={logoSources[variant]}
        alt={decorative ? "" : "MIVO"}
        aria-hidden={decorative ? true : undefined}
      />
    </span>
  );
}
