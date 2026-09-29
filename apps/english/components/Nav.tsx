"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/listening", label: "Listening" },
  { href: "/speaking", label: "Speaking" },
  { href: "/review", label: "Cards" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="mx-auto flex w-full max-w-4xl items-center gap-5 px-6 pt-6 text-sm">
      <Link href="/" className={`mr-auto font-medium tracking-tight transition ${path === "/" ? "text-foreground" : "text-muted hover:text-foreground"}`}>
        english<span className="text-accent">.</span>
      </Link>
      {LINKS.map((l) => {
        const on = path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={`group relative py-1 transition ${on ? "text-foreground" : "text-muted hover:text-foreground"}`}>
            {l.label}
            <span
              className={`absolute inset-x-0 -bottom-0.5 h-px origin-left bg-accent transition-transform duration-300 ${on ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`}
            />
          </Link>
        );
      })}
    </nav>
  );
}
