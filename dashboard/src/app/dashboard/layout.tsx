"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Calendar,
  Mail,
  BarChart3,
  Settings,
  Menu,
  Bell,
  X,
  User,
  LogOut,
  FileCheck,
  Search,
} from "lucide-react";

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPalette } from "@/components/command-palette";
import { mockNotifications, mockBadgeCounts } from "@/lib/mock-data";

type NavSection = {
  title: string;
  items: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[];
};

const navSections: NavSection[] = [
  {
    title: "Pipeline",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/jobs", label: "Jobs", icon: Briefcase, badge: mockBadgeCounts.jobs },
      { href: "/dashboard/cv", label: "CV Packages", icon: FileCheck },
      { href: "/dashboard/applications", label: "Applications", icon: FileText, badge: mockBadgeCounts.applications },
      { href: "/dashboard/interviews", label: "Interviews", icon: Calendar, badge: mockBadgeCounts.interviews },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { href: "/dashboard/emails", label: "Emails", icon: Mail, badge: mockBadgeCounts.emails },
      { href: "/dashboard/metrics", label: "Metrics", icon: BarChart3 },
      { href: "/dashboard/linkedin", label: "LinkedIn", icon: LinkedinIcon },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
];

const notificationIcon: Record<string, string> = {
  interview: "text-amber-500",
  cv: "text-cyan-500",
  followup: "text-red-500",
};

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3 py-2">
      {navSections.map((section) => (
        <div key={section.title} className="mb-2">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            {section.title}
          </p>
          {section.items.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary px-1.5">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <CommandPalette />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-56 md:flex-col border-r border-border bg-card">
        <div className="flex h-14 items-center gap-2 px-4 border-b border-border">
          <Briefcase className="h-5 w-5 text-cyan-500" />
          <span className="font-semibold text-sm tracking-tight">
            JobPilot
          </span>
        </div>
        <ScrollArea className="flex-1 py-2">
          <SidebarNav />
        </ScrollArea>
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-56 p-0 bg-card">
          <div className="flex h-14 items-center gap-2 px-4 border-b border-border">
            <Briefcase className="h-5 w-5 text-cyan-500" />
            <span className="font-semibold text-sm tracking-tight">
              JobPilot
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-7 w-7"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 py-2">
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 items-center gap-4 border-b border-border bg-card px-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>

          {/* Search trigger */}
          <button
            onClick={() => {
              document.dispatchEvent(
                new KeyboardEvent("keydown", { key: "k", metaKey: true })
              );
            }}
            className="hidden sm:flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search...</span>
            <kbd className="ml-4 rounded bg-background px-1.5 py-0.5 text-[10px] font-mono border border-border">
              Cmd+K
            </kbd>
          </button>

          <div className="flex-1" />

          <ThemeToggle />

          {/* Notification Bell */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none"
            >
              <Bell className="h-4 w-4" />
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] leading-none"
              >
                {mockNotifications.length}
              </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {mockNotifications.map((notification) => (
                <DropdownMenuItem key={notification.id} className="flex flex-col items-start gap-1 py-3">
                  <div className="flex items-center gap-2 w-full">
                    <span className={cn("text-sm font-medium", notificationIcon[notification.type])}>
                      {notification.title}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {notification.description}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70">
                    {notification.time}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-6" />

          {/* User Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-accent">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-100">
                  S
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-sm font-medium">Selvi</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Selvi Chellamma</span>
                    <span className="text-xs text-muted-foreground font-normal">chellamma.uk@gmail.com</span>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => window.location.href = "/dashboard/settings"}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.location.href = "/dashboard/settings"}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
