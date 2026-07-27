import { useTheme } from "@/components/theme-provider";

type Props = {
  className?: string;
  alt?: string;
};

export function BrandLogo({ className, alt = "4Creative" }: Props) {
  const { theme } = useTheme();
  const src = theme === "dark" ? "/logo-dark.png" : "/logo-light.png";
  return <img src={src} alt={alt} className={className} />;
}