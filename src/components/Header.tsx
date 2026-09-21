import { headers } from "next/headers";
import Link from "next/link";
import { getHouseholdContext } from "@/lib/household";
import HeaderNav from "./HeaderNav";
import Logo from "./Logo";
import SignOutButton from "./SignOutButton";
import ThemeToggle from "./ThemeToggle";

export default async function Header() {
  // The header must never break a page (e.g. while the DB is down).
  const ctx = await getHouseholdContext(await headers()).catch(() => null);

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      {/* Phone: logo and controls on the first row, the three destinations on
          their own row below. From `sm` up everything sits on one line. */}
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm sm:h-14 sm:flex-nowrap sm:py-0">
        <Link href="/" aria-label="Monies home">
          <Logo />
        </Link>
        {ctx && (
          <HeaderNav className="order-last basis-full gap-6 sm:order-none sm:ml-auto sm:basis-auto sm:gap-4" />
        )}
        <div className="ml-auto flex items-center gap-3 sm:ml-0 sm:gap-4">
          {ctx && (
            <>
              <span className="hidden text-muted sm:inline">{ctx.user.name}</span>
              <SignOutButton />
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
