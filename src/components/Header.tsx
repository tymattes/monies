import { headers } from "next/headers";
import Link from "next/link";
import { getHouseholdContext } from "@/lib/household";
import Logo from "./Logo";
import SignOutButton from "./SignOutButton";
import ThemeToggle from "./ThemeToggle";

export default async function Header() {
  // The header must never break a page (e.g. while the DB is down).
  const ctx = await getHouseholdContext(await headers()).catch(() => null);

  return (
    <header className="sticky top-0 z-10 border-b border-foreground/10 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
        <Link href="/" aria-label="Monies home">
          <Logo />
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {ctx && (
            <nav className="flex items-center gap-4">
              <Link href="/budget" className="text-muted hover:text-foreground">
                Budget
              </Link>
              <Link href="/income" className="text-muted hover:text-foreground">
                Income
              </Link>
              <Link href="/members" className="text-muted hover:text-foreground">
                Members
              </Link>
              <span className="hidden text-muted sm:inline">
                {ctx.user.name}
              </span>
              <SignOutButton />
            </nav>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
