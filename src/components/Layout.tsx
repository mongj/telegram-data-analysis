import {
  Clock,
  Heart,
  LayoutDashboard,
  MessageSquare,
  Send,
  Video,
} from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import GlobalFilters from "./GlobalFilters";

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: "/", label: "Overview", icon: LayoutDashboard },
  { path: "/chats", label: "Chat Details", icon: MessageSquare },
  { path: "/reactions", label: "Reactions", icon: Heart },
  { path: "/activity", label: "Activity Patterns", icon: Clock },
  { path: "/media", label: "Tele Bubbles", icon: Video },
];

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-dark-950 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-dark-900 border-r border-dark-700 flex flex-col fixed h-full">
        {/* Logo */}
        <div className="p-6 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center">
              <Send className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display font-semibold text-dark-100">
                Telegram
              </h1>
              <p className="text-xs text-dark-500">Analytics Dashboard</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navItems.map((item, index) => (
              <li
                key={item.path}
                style={{ animationDelay: `${index * 0.05}s` }}
                className="animate-slide-in opacity-0"
              >
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive
                        ? "bg-dark-700 text-accent-blue"
                        : "text-dark-400 hover:text-dark-200 hover:bg-dark-800"
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium text-sm">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-dark-700">
          <p className="text-xs text-dark-600 text-center">
            Built with Recharts & D3
          </p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Global Filters - Sticky */}
        <div className="sticky top-0 z-30">
          <GlobalFilters />
        </div>

        {/* Page Content */}
        <main className="flex-1 p-8 relative" style={{ zIndex: 1 }}>
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
