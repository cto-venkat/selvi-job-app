"use client";

import { useEffect, useState, useCallback } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Calendar,
  Mail,
  BarChart3,
  Settings,
  Plus,
  Search,
  FileCheck,
} from "lucide-react";

function LinkedinIconSmall({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  function navigate(path: string) {
    router.push(path);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      {/* Dialog */}
      <div className="fixed left-1/2 top-[20%] w-full max-w-lg -translate-x-1/2">
        <Command
          className="rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden"
          label="Command palette"
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Command.Input
              placeholder="Search jobs, companies, actions..."
              className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* Navigation */}
            <Command.Group heading="Navigate" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
              <Command.Item onSelect={() => navigate("/dashboard")} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground">
                <LayoutDashboard className="h-4 w-4 text-muted-foreground" /> Overview
              </Command.Item>
              <Command.Item onSelect={() => navigate("/dashboard/jobs")} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground">
                <Briefcase className="h-4 w-4 text-muted-foreground" /> Jobs
              </Command.Item>
              <Command.Item onSelect={() => navigate("/dashboard/cv")} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground">
                <FileCheck className="h-4 w-4 text-muted-foreground" /> CV Packages
              </Command.Item>
              <Command.Item onSelect={() => navigate("/dashboard/applications")} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground">
                <FileText className="h-4 w-4 text-muted-foreground" /> Applications
              </Command.Item>
              <Command.Item onSelect={() => navigate("/dashboard/interviews")} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground">
                <Calendar className="h-4 w-4 text-muted-foreground" /> Interviews
              </Command.Item>
              <Command.Item onSelect={() => navigate("/dashboard/emails")} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground">
                <Mail className="h-4 w-4 text-muted-foreground" /> Emails
              </Command.Item>
              <Command.Item onSelect={() => navigate("/dashboard/metrics")} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground">
                <BarChart3 className="h-4 w-4 text-muted-foreground" /> Metrics
              </Command.Item>
              <Command.Item onSelect={() => navigate("/dashboard/linkedin")} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground">
                <LinkedinIconSmall className="h-4 w-4 text-muted-foreground" /> LinkedIn
              </Command.Item>
              <Command.Item onSelect={() => navigate("/dashboard/settings")} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground">
                <Settings className="h-4 w-4 text-muted-foreground" /> Settings
              </Command.Item>
            </Command.Group>

            {/* Quick Actions */}
            <Command.Group heading="Quick Actions" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
              <Command.Item onSelect={() => navigate("/dashboard/applications?add=true")} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground">
                <Plus className="h-4 w-4 text-muted-foreground" /> Add application
              </Command.Item>
            </Command.Group>

            {/* Recent Jobs - loaded dynamically */}
            {/* Applications - loaded dynamically */}
          </Command.List>

          <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground flex items-center gap-4">
            <span><kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">Esc</kbd> to close</span>
            <span><kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">Enter</kbd> to select</span>
            <span><kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">Up/Down</kbd> to navigate</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
