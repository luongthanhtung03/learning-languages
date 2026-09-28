"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/listening", label: "Listening" },
  { href: "/speaking", label: "Speaking" },
];

export function Nav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <nav className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-5xl items-center gap-1 px-4">
        <Link href="/" className="mr-4 py-3 text-sm font-semibold">English practice</Link>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`border-b-2 px-3 py-3 text-sm transition ${
              active(l.href) ? "border-accent font-medium text-foreground" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
