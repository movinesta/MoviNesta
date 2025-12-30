import React from "react";
import { NavLink } from "react-router-dom";
import { cn } from "../lib/ui";
import { LayoutDashboard, Cpu, CalendarClock, Users, ScrollText, DollarSign, ShieldCheck, LogOut } from "lucide-react";

const items = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/embeddings", label: "Embeddings", icon: Cpu },
  { to: "/jobs", label: "Jobs", icon: CalendarClock },
  { to: "/users", label: "Users", icon: Users },
  { to: "/logs", label: "Logs", icon: ScrollText },
  { to: "/audit", label: "Audit", icon: ShieldCheck },
  { to: "/costs", label: "Costs", icon: DollarSign },
];

export function NavSidebar(props: { appName?: string; onSignOut: () => void }) {
  return (
    <div className="flex h-full w-64 flex-col border-r border-zinc-200 bg-white/90 p-4">
      <div className="mb-4">
        <div className="text-lg font-semibold tracking-tight text-zinc-900">{props.appName ?? "Admin"}</div>
        <div className="text-xs text-zinc-500">MoviNesta control center</div>
      </div>

      <div className="flex-1 space-y-1">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100",
                  isActive && "bg-zinc-200 text-zinc-900",
                )
              }
            >
              <Icon size={18} />
              {it.label}
            </NavLink>
          );
        })}
      </div>

      <button
        onClick={props.onSignOut}
        className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
      >
        <LogOut size={18} />
        Sign out
      </button>
    </div>
  );
}
