import Link from "next/link";

type AppLogoProps = {
  href?: string;
  showMark?: boolean;
};

export function AppLogo({ href = "/", showMark = false }: AppLogoProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2.5 rounded-lg text-xl font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
    >
      {showMark ? (
        <span
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
        >
          S
        </span>
      ) : null}
      SplitHero
    </Link>
  );
}
