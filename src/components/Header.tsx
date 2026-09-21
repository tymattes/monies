import Link from "next/link";
import Logo from "./Logo";

export default function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-foreground/10 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" aria-label="Monies home">
          <Logo />
        </Link>
        {/* Reserved for future navigation / household switcher */}
        <div />
      </div>
    </header>
  );
}
