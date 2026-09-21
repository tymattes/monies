import { headers } from "next/headers";
import Link from "next/link";
import { getHouseholdContext } from "@/lib/household";
import Logo from "./Logo";
import SignOutButton from "./SignOutButton";

export default async function Header() {
  // The header must never break a page (e.g. while the DB is down).
  const ctx = await getHouseholdContext(await headers()).catch(() => null);

  return (
    <header className="sticky top-0 z-10 border-b border-foreground/10 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" aria-label="Monies home">
          <Logo />
        </Link>
        {ctx && (
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/budget"
              className="text-foreground/70 hover:text-foreground"
            >
              Budget
            </Link>
            <Link
              href="/members"
              className="text-foreground/70 hover:text-foreground"
            >
              Members
            </Link>
            <span className="hidden text-foreground/50 sm:inline">
              {ctx.user.name}
            </span>
            <SignOutButton />
          </nav>
        )}
      </div>
    </header>
  );
}
