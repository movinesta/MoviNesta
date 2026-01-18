import React from "react";
import { Link } from "react-router-dom";
import { User as UserIcon, Mail, Bell, Monitor, ChevronRight } from "lucide-react";
import { PageSection } from "../../components/PageChrome";
import TopBar from "../../components/shared/TopBar";

interface SettingsItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  to: string;
  label: string;
}

const BASE_ITEMS: SettingsItem[] = [
  {
    title: "Profile",
    description: "Display name, bio, and how you appear to others.",
    icon: <UserIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />,
    to: "/settings/profile",
    label: "Profile settings",
  },
  {
    title: "Account",
    description: "Email, sign-in and account basics.",
    icon: <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />,
    to: "/settings/account",
    label: "Account settings",
  },
  {
    title: "Notifications",
    description: "Emails and in-app alerts from MoviNesta.",
    icon: <Bell className="h-4 w-4 text-muted-foreground" aria-hidden="true" />,
    to: "/settings/notifications",
    label: "Notification settings",
  },
  {
    title: "App",
    description: "Start screen and motion preferences.",
    icon: <Monitor className="h-4 w-4 text-muted-foreground" aria-hidden="true" />,
    to: "/settings/app",
    label: "App settings",
  },
];

const SettingsOverviewPage: React.FC = () => {
  const items: SettingsItem[] = BASE_ITEMS;

  return (
    <div className="flex flex-1 flex-col gap-[var(--section-gap)] pb-[var(--page-pad-y)]">
      <TopBar title="Settings" />

      {/* List of sections */}
      <section className="space-y-[var(--section-gap)] page-pad pb-2">
        <PageSection padded={false}>
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="soft-row-card soft-row-card-interactive flex items-center gap-3 row-pad min-h-11 focus-visible:outline-none"
                  aria-label={item.label}
                >
                  <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-border/50">
                    {item.icon}
                  </span>
                  <div className="flex-1 space-y-0.5">
                    <p className="text-sm font-heading font-semibold text-foreground">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 flex-none text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </PageSection>

        <p className="text-xs text-muted-foreground">
          You can come back here anytime from the sidebar or app menu.
        </p>
      </section>
    </div>
  );
};

export default SettingsOverviewPage;
