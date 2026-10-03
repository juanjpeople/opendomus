"use client";

import { Menu } from "antd";
import { House, Palette, Refrigerator, ShoppingCart, Wrench, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { can, type Permission } from "@/lib/auth/permissions";
import { useCurrentUser } from "@/lib/auth/session";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Si se define, el ítem solo aparece para quien tenga el permiso. */
  permission?: Permission;
}

/** Para agregar una sección: sumarla acá (y proteger la página con `RequirePermission`). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/alacena", label: "Alacena", icon: Refrigerator, permission: "inventory.view" },
  { href: "/taller", label: "Taller", icon: Wrench, permission: "inventory.view" },
  { href: "/compras", label: "Compras", icon: ShoppingCart, permission: "shopping.view" },
  { href: "/design", label: "Sistema de diseño", icon: Palette, permission: "settings.design" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const user = useCurrentUser();

  const items = NAV_ITEMS.filter((item) => !item.permission || can(user, item.permission)).map(
    ({ href, label, icon: Icon }) => ({
      key: href,
      icon: <Icon />,
      label: (
        <Link href={href} onClick={onNavigate}>
          {label}
        </Link>
      ),
    }),
  );

  const selected = NAV_ITEMS.find((item) => isActive(pathname, item.href))?.href;

  return <Menu mode="inline" selectedKeys={selected ? [selected] : []} items={items} style={{ borderInlineEnd: 0, background: "transparent" }} />;
}
