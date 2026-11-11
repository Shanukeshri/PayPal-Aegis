import React from 'react';
import {
  HomeIcon,
  BanknotesIcon,
  ClipboardDocumentCheckIcon,
  ShieldExclamationIcon,
  BellAlertIcon,
  WrenchScrewdriverIcon,
  PlayIcon,
  ShieldCheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { NavPage } from '../../types';

interface SidebarProps {
  activePage: NavPage;
  onSelectPage: (page: NavPage) => void;
  onOpenDevTools: () => void;
  onOpenDemo: () => void;
  isDevToolsOpen: boolean;
  isDemoOpen: boolean;
  pendingApprovalsCount: number;
  hasOpenDispute: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onSelectPage,
  onOpenDevTools,
  onOpenDemo,
  isDevToolsOpen,
  isDemoOpen,
  pendingApprovalsCount,
  hasOpenDispute,
  mobileOpen,
  onCloseMobile,
}) => {
  const navItems: Array<{
    id: NavPage;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | 'dot';
  }> = [
    { id: 'overview', label: 'Overview', icon: HomeIcon },
    { id: 'escrow', label: 'Escrow', icon: BanknotesIcon },
    {
      id: 'delivery',
      label: 'Delivery',
      icon: ClipboardDocumentCheckIcon,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
    },
    {
      id: 'disputes',
      label: 'Disputes',
      icon: ShieldExclamationIcon,
      badge: hasOpenDispute ? 'dot' : undefined,
    },
    { id: 'activity', label: 'Activity', icon: BellAlertIcon },
  ];

  const handleNav = (page: NavPage) => {
    onSelectPage(page);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-[#E5E0D8] w-56 select-none">
      {/* Logo */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-[#E5E0D8]">
        <button
          type="button"
          onClick={() => handleNav('overview')}
          className="flex items-center space-x-2.5 text-left focus:outline-none focus:ring-2 focus:ring-[#0070BA] rounded-lg"
        >
          <div className="w-8 h-8 rounded-lg bg-[#0070BA] flex items-center justify-center text-white shadow-subtle">
            <ShieldCheckIcon className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-[#1C1917] block leading-tight">
              PayPal Aegis
            </span>
            <span className="text-[10px] text-[#78716C] block leading-tight">
              Milestone Escrow
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1 rounded-md text-[#57534E] hover:text-[#1C1917] hover:bg-[#F4F1EA]"
          aria-label="Close navigation menu"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Main Navigation */}
      <nav aria-label="Primary Navigation" className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition ${
                isActive
                  ? 'bg-[#E6F2FA] text-[#0070BA] font-semibold'
                  : 'text-[#57534E] hover:text-[#1C1917] hover:bg-[#F9F8F5]'
              }`}
            >
              <span className="flex items-center space-x-2.5">
                <item.icon
                  className={`w-4 h-4 flex-shrink-0 ${
                    isActive ? 'text-[#0070BA]' : 'text-[#78716C]'
                  }`}
                />
                <span>{item.label}</span>
              </span>

              {typeof item.badge === 'number' && (
                <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-[#0070BA] text-white">
                  {item.badge}
                </span>
              )}
              {item.badge === 'dot' && (
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Drawer Triggers */}
      <div className="px-3 py-3 border-t border-[#E5E0D8] space-y-1">
        <button
          type="button"
          onClick={() => {
            onOpenDevTools();
            onCloseMobile();
          }}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition ${
            isDevToolsOpen
              ? 'bg-[#1C1917] text-white'
              : 'text-[#57534E] hover:text-[#1C1917] hover:bg-[#F9F8F5]'
          }`}
        >
          <span className="flex items-center space-x-2.5">
            <WrenchScrewdriverIcon
              className={`w-4 h-4 flex-shrink-0 ${
                isDevToolsOpen ? 'text-white' : 'text-[#78716C]'
              }`}
            />
            <span>Dev tools</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenDemo();
            onCloseMobile();
          }}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition ${
            isDemoOpen
              ? 'bg-[#0070BA] text-white shadow-subtle'
              : 'text-[#0070BA] bg-[#E6F2FA]/60 hover:bg-[#E6F2FA]'
          }`}
        >
          <span className="flex items-center space-x-2.5">
            <span>Demo</span>
          </span>
          <PlayIcon className="w-3.5 h-3.5 fill-current" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Static Sidebar */}
      <aside className="hidden lg:flex lg:flex-shrink-0">{sidebarContent}</aside>

      {/* Mobile Overlay Sidebar */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex bg-[#1C1917]/40 backdrop-blur-sm"
          onClick={onCloseMobile}
        >
          <div className="h-full" onClick={(e) => e.stopPropagation()}>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
