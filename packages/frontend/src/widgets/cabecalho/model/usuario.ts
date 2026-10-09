export const HEADER_NAVIGATION = [
  { name: "Início", href: "/" },
  { name: "Equipamentos", href: "/equipamentos" },
  { name: "Orçamento", href: "/orcamento" },
  { name: "Sobre", href: "/sobre" },
  { name: "Contato", href: "/contato" },
] as const;

export const HEADER_INTERNAL_NAV_KEY = "internalNavigation";
export const HEADER_SCROLL_KEY = "adjustScrollAfterLoad";
export const HEADER_CLIENT_ANCHOR = "dashboard-banner";
export const HEADER_CLIENT_AREA_HREF = "/area-cliente#dashboard-banner";
export const HEADER_EQUIPMENTS_HREF = "/equipamentos";

export const HEADER_STAFF_ROLES = ["ADMIN", "OPERATOR", "FINANCIAL"] as const;

export function shouldAdjustClientAreaScroll(pathname: string | null): boolean {
  return !pathname?.startsWith("/area-cliente");
}

export function shouldAdjustMobileClientMenu(isMobile: boolean, href: string): boolean {
  return isMobile && href.startsWith("/area-cliente");
}

export function buildHeaderUserMenu(isStaff: boolean): Array<{
  href: string;
  label: string;
  showBadge?: boolean;
}> {
  const items = [
    { href: "/area-cliente", label: "Dashboard" },
    { href: "/area-cliente/notificacoes", label: "Notificações", showBadge: true },
    { href: "/area-cliente/perfil", label: "Meu Perfil" },
    { href: "/area-cliente/historico", label: "Meus Orçamentos" },
    { href: "/area-cliente/enderecos", label: "Endereços" },
    { href: "/contato", label: "Suporte" },
  ];
  if (!isStaff) return items;
  return [{ href: "/admin", label: "Painel Administrador" }, ...items];
}

export function isHeaderStaff(role?: string | null): boolean {
  return Boolean(role && (HEADER_STAFF_ROLES as readonly string[]).includes(role));
}

export function isHeaderActivePage(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function getHeaderUserInitials(name?: string | null): string {
  if (!name) return "U";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) {
    const firstChar = parts[0]?.[0];
    return firstChar ? firstChar.toUpperCase() : "U";
  }
  const firstChar = parts[0]?.[0] ?? "";
  const lastChar = parts[parts.length - 1]?.[0] ?? "";
  return (firstChar + lastChar).toUpperCase() || "U";
}

export function getHeaderFirstName(name?: string | null): string {
  if (!name) return "Cliente";
  const firstName = name.trim().split(" ")[0];
  if (!firstName) return "Cliente";
  return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
}
