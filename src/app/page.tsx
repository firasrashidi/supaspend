import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border/40">
        <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Image
              src="/icon.svg"
              alt="Supaspend logo"
              width={24}
              height={24}
              priority
            />
            supaspend
          </Link>
          <nav className="ml-auto flex items-center gap-4">
            {user ? (
              <Button asChild>
                <Link href="/tracker">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                <Button asChild>
                  <Link href="/sign-up">Get started</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-24">
        <div className="mx-auto max-w-2xl space-y-8 text-center">
          <h1 className="mx-auto flex flex-nowrap items-center justify-center gap-2 text-center text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
            <span aria-hidden="true">💸</span>
            <span>
              Take control of your{" "}
              <span className="marker-highlight px-1 text-foreground">
                money
              </span>
            </span>
            <span aria-hidden="true">💸</span>
          </h1>
          <p className="text-lg text-muted-foreground sm:text-xl">
            Supaspend keeps your budget on a leash and your splurges on a short
            break. Track spending, set goals, and still treat yourself.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" asChild className="text-base">
              <Link href="/sign-up">Create free account</Link>
            </Button>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/40 bg-black py-6 text-white">
        <div className="container px-4 text-center text-sm text-white/80">
          © {new Date().getFullYear()} Supaspend. Personal finance, simplified.
        </div>
      </footer>
    </div>
  );
}
