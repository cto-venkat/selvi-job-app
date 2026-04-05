"use client";

import { useState } from "react";
import { mockSettings } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { User, Search, Bell, Workflow, Globe, X, Plus, Check, Loader2 } from "lucide-react";

function LinkedinIconSmall({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" /><circle cx="4" cy="4" r="2" />
    </svg>
  );
}

export default function SettingsPage() {
  const [profile, setProfile] = useState(mockSettings.profile);
  const [searchConfig, setSearchConfig] = useState(mockSettings.searchConfig);
  const [notifications, setNotifications] = useState(mockSettings.notifications);
  const [newTerm, setNewTerm] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSearch, setSavingSearch] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [savedSearch, setSavedSearch] = useState(false);
  const [savedNotifications, setSavedNotifications] = useState(false);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      setSavedProfile(true);
      setTimeout(() => setSavedProfile(false), 2000);
    } catch {
      console.error("Failed to save profile settings");
    }
    setSavingProfile(false);
  }

  async function saveSearch() {
    setSavingSearch(true);
    try {
      await fetch("/api/settings/search", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(searchConfig),
      });
      setSavedSearch(true);
      setTimeout(() => setSavedSearch(false), 2000);
    } catch {
      console.error("Failed to save search settings");
    }
    setSavingSearch(false);
  }

  async function saveNotifications() {
    setSavingNotifications(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifications }),
      });
      setSavedNotifications(true);
      setTimeout(() => setSavedNotifications(false), 2000);
    } catch {
      console.error("Failed to save notification settings");
    }
    setSavingNotifications(false);
  }

  function addSearchTerm() {
    if (!newTerm.trim()) return;
    setSearchConfig({
      ...searchConfig,
      searchTerms: [...searchConfig.searchTerms, newTerm.trim()],
    });
    setNewTerm("");
  }

  function removeSearchTerm(term: string) {
    setSearchConfig({
      ...searchConfig,
      searchTerms: searchConfig.searchTerms.filter((t) => t !== term),
    });
  }

  function toggleSource(source: string) {
    const sources = searchConfig.sources.includes(source)
      ? searchConfig.sources.filter((s) => s !== source)
      : [...searchConfig.sources, source];
    setSearchConfig({ ...searchConfig, sources });
  }

  const allSources = ["Reed", "Adzuna", "RSS Feeds", "LinkedIn", "Indeed", "Glassdoor"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile, search, and system configuration</p>
      </div>

      <Tabs defaultValue={0}>
        <TabsList>
          <TabsTrigger value={0}>
            <User className="h-3.5 w-3.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger value={1}>
            <Search className="h-3.5 w-3.5" />
            Job Search
          </TabsTrigger>
          <TabsTrigger value={2}>
            <Bell className="h-3.5 w-3.5" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value={3}>
            <Globe className="h-3.5 w-3.5" />
            Connections
          </TabsTrigger>
          <TabsTrigger value={4}>
            <Workflow className="h-3.5 w-3.5" />
            System
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value={0}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Candidate Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              <div>
                <label className="text-xs text-muted-foreground">Name</label>
                <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <Input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Phone</label>
                <Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Location</label>
                <Input value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Salary Range</label>
                <Input value={profile.salaryRange} onChange={(e) => setProfile({ ...profile, salaryRange: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Notice Period</label>
                <Input value={profile.noticePeriod} onChange={(e) => setProfile({ ...profile, noticePeriod: e.target.value })} />
              </div>
              <Button size="sm" onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : savedProfile ? <Check className="h-3 w-3 mr-1" /> : null}
                {savedProfile ? "Saved" : "Save Profile"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Job Search Tab */}
        <TabsContent value={1}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Job Search Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">SEARCH TERMS</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {searchConfig.searchTerms.map((term) => (
                    <Badge key={term} variant="secondary" className="text-xs gap-1">
                      {term}
                      <button onClick={() => removeSearchTerm(term)} className="ml-0.5 hover:text-red-500">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add search term..."
                    value={newTerm}
                    onChange={(e) => setNewTerm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSearchTerm()}
                    className="flex-1"
                  />
                  <Button variant="outline" size="sm" onClick={addSearchTerm} disabled={!newTerm.trim()}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">SOURCES</p>
                <div className="flex flex-wrap gap-2">
                  {allSources.map((source) => (
                    <label key={source} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={searchConfig.sources.includes(source)}
                        onChange={() => toggleSource(source)}
                        className="rounded border-input"
                      />
                      {source}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Min Salary</label>
                  <Input type="number" value={searchConfig.salaryMin} onChange={(e) => setSearchConfig({ ...searchConfig, salaryMin: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Max Salary</label>
                  <Input type="number" value={searchConfig.salaryMax} onChange={(e) => setSearchConfig({ ...searchConfig, salaryMax: Number(e.target.value) })} />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">LOCATION PREFERENCES</p>
                <div className="flex flex-wrap gap-1.5">
                  {searchConfig.locations.map((loc) => (
                    <Badge key={loc} variant="secondary" className="text-xs">{loc}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">TIER THRESHOLDS</p>
                <dl className="space-y-1">
                  {Object.entries(searchConfig.tierThresholds).map(([tier, range]) => (
                    <div key={tier} className="flex justify-between items-center">
                      <dt className="text-sm font-mono font-medium">{tier}</dt>
                      <dd className="text-sm text-muted-foreground">{range}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <Button size="sm" onClick={saveSearch} disabled={savingSearch}>
                {savingSearch ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : savedSearch ? <Check className="h-3 w-3 mr-1" /> : null}
                {savedSearch ? "Saved" : "Save Search Config"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value={2}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              <label className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Email notifications</span>
                <button
                  onClick={() => setNotifications({ ...notifications, emailEnabled: !notifications.emailEnabled })}
                  className={`relative h-6 w-11 rounded-full transition-colors ${notifications.emailEnabled ? "bg-cyan-500" : "bg-muted"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${notifications.emailEnabled ? "translate-x-5" : ""}`} />
                </button>
              </label>
              <div>
                <label className="text-xs text-muted-foreground">Recipient</label>
                <Input value={notifications.recipient} onChange={(e) => setNotifications({ ...notifications, recipient: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Daily Digest Time</label>
                <Input type="time" value={notifications.digestTime} onChange={(e) => setNotifications({ ...notifications, digestTime: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Quiet Hours Start</label>
                  <Input type="time" value={notifications.quietHoursStart} onChange={(e) => setNotifications({ ...notifications, quietHoursStart: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Quiet Hours End</label>
                  <Input type="time" value={notifications.quietHoursEnd} onChange={(e) => setNotifications({ ...notifications, quietHoursEnd: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Urgent bypass quiet hours</span>
                <button
                  onClick={() => setNotifications({ ...notifications, urgentBypassQuietHours: !notifications.urgentBypassQuietHours })}
                  className={`relative h-6 w-11 rounded-full transition-colors ${notifications.urgentBypassQuietHours ? "bg-cyan-500" : "bg-muted"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${notifications.urgentBypassQuietHours ? "translate-x-5" : ""}`} />
                </button>
              </label>
              <Button size="sm" onClick={saveNotifications} disabled={savingNotifications}>
                {savingNotifications ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : savedNotifications ? <Check className="h-3 w-3 mr-1" /> : null}
                {savedNotifications ? "Saved" : "Save Notifications"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Connections Tab */}
        <TabsContent value={3}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Connected Accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-w-lg">
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"/></svg>
                  <div>
                    <p className="text-sm font-medium">Gmail</p>
                    <p className="text-xs text-muted-foreground">
                      {mockSettings.connectedAccounts.gmail.connected ? mockSettings.connectedAccounts.gmail.email : "Not connected"}
                    </p>
                  </div>
                </div>
                <Button variant={mockSettings.connectedAccounts.gmail.connected ? "outline" : "default"} size="sm">
                  {mockSettings.connectedAccounts.gmail.connected ? "Disconnect" : "Connect"}
                </Button>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <LinkedinIconSmall className="h-5 w-5 text-[#0077B5]" />
                  <div>
                    <p className="text-sm font-medium">LinkedIn</p>
                    <p className="text-xs text-muted-foreground">
                      {mockSettings.connectedAccounts.linkedin.connected ? mockSettings.connectedAccounts.linkedin.profile : "Not connected"}
                    </p>
                  </div>
                </div>
                <Badge variant={mockSettings.connectedAccounts.linkedin.connected ? "default" : "secondary"}
                  className={mockSettings.connectedAccounts.linkedin.connected ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : ""}>
                  {mockSettings.connectedAccounts.linkedin.connected ? "Connected" : "Not connected"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value={4}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {mockSettings.workflows.map((wf) => (
                  <div key={wf.id} className="flex items-center justify-between py-1.5 px-2 rounded border border-border">
                    <span className="text-sm truncate mr-2">{wf.name}</span>
                    <Badge
                      variant={wf.status === "active" ? "default" : "secondary"}
                      className={`text-[10px] shrink-0 ${
                        wf.status === "active"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800/40 dark:text-zinc-400"
                      }`}
                    >
                      {wf.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
