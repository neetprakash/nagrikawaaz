'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar';
import { api, clearToken, getStoredUser, API_URL } from '../lib/api';
import GlobalSearch from './GlobalSearch';

function useClickOutsideAndEscape(ref, onClose) {
  useEffect(() => {
    if (!ref.current) return;
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, onClose]);
}

function readNotifIds() {
  if (typeof window === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem('civic_notif_read_ids') || '[]'));
  } catch {
    return new Set();
  }
}

export default function NavBar() {
  const [user, setUser] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [notifCount, setNotifCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [mobileCreateOpen, setMobileCreateOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const createRef = useRef(null);
  const mobileCreateRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const pathname = usePathname();

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  // Re-sync on login / logout / profile update (same-tab + cross-tab).
  useEffect(() => {
    function sync() {
      setUser(getStoredUser());
    }
    window.addEventListener('civic:auth-change', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('civic:auth-change', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function tick() {
      try {
        const [pendingRes, notifRes] = await Promise.all([
          api.pendingRequests(),
          api.notifications().catch(() => null),
        ]);
        if (cancelled) return;
        setPendingCount(pendingRes.requests?.length || 0);
        if (notifRes) {
          const readIds = readNotifIds();
          const unread = (notifRes.notifications || []).filter((n) => !readIds.has(n.id)).length;
          setNotifCount(unread);
        }
      } catch {
        // 401 — token expired, next action will redirect
      }
    }
    tick();
    const id = setInterval(tick, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user]);

  useClickOutsideAndEscape(menuRef, () => setMenuOpen(false));
  useClickOutsideAndEscape(createRef, () => setCreateOpen(false));
  useClickOutsideAndEscape(mobileCreateRef, () => setMobileCreateOpen(false));
  useClickOutsideAndEscape(mobileMenuRef, () => setMobileMenuOpen(false));

  function logout() {
    clearToken();
    if (typeof window !== 'undefined') window.location.href = '/';
  }

  function navigate(href) {
    setMobileCreateOpen(false);
    setMobileMenuOpen(false);
    if (typeof window !== 'undefined') window.location.href = href;
  }

  const avatarSrc = user?.avatar_url
    ? user.avatar_url.startsWith('http')
      ? user.avatar_url
      : `${API_URL}${user.avatar_url}`
    : null;

  // ---- Shared nav items so desktop + mobile stay in sync ----
  const desktopNavItems = (
    <>
      <SidebarLink href="/" icon={<IconHome />} label="Home" active={pathname === '/'} />
      <SidebarLink href="/polls" icon={<IconPolls />} label="Polls" active={pathname?.startsWith('/polls')} />
      <SidebarLink href="/explore" icon={<IconSearch />} label="Explore" active={pathname?.startsWith('/explore')} />
      <SidebarLink href="/leaderboard" icon={<IconTrophy />} label="Leaderboard" active={pathname?.startsWith('/leaderboard')} />
      {user && (
        <SidebarLink
          href="/inbox"
          icon={<IconInbox />}
          label="Inbox"
          badge={pendingCount}
          title="pending requests"
          active={pathname?.startsWith('/inbox')}
        />
      )}
      {user && (
        <SidebarLink
          href="/notifications"
          icon={<IconBell />}
          label="Notifications"
          badge={notifCount}
          title="unread"
          active={pathname?.startsWith('/notifications')}
        />
      )}
      {user && (user.role === 'moderator' || user.role === 'admin') && (
        <SidebarLink href="/moderation" icon={<IconShield />} label="Reported Posts" active={pathname?.startsWith('/moderation')} />
      )}
      {user && user.role === 'official' && (
        <SidebarLink href="/officials" icon={<IconLandmark />} label="Official Dashboard" active={pathname?.startsWith('/officials')} />
      )}
    </>
  );

  return (
    <>
      {/* ---------- DESKTOP: fixed left sidebar (md+) ----------
          No background class here on purpose — it inherits whatever the page
          background is, so the sidebar and feed read as one continuous
          surface instead of a separated colored block (X.com-style). */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 flex-col z-40">
        <Link href="/" className="px-5 pt-5 pb-3 flex items-center gap-2">
          <img src="/logo.png" alt="Nagrik Awaaz" className="h-9 w-auto" />
        </Link>

        <div className="px-3 pb-3">
          <GlobalSearch />
        </div>

        <nav className="flex-1 overflow-y-auto py-1">
          {desktopNavItems}

          {user && (
            <div className="relative px-3 mt-3" ref={createRef}>
              <button
                type="button"
                onClick={() => setCreateOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={createOpen}
                className="w-full bg-saffron text-navy px-4 py-2.5 rounded-full font-semibold hover:opacity-90 flex items-center justify-center gap-2 transition"
                title="Create a new post"
              >
                <IconPlus className="w-5 h-5" />
                <span>Create</span>
              </button>
              {createOpen && (
                <div
                  role="menu"
                  className="absolute left-full top-0 ml-2 w-56 bg-white text-gray-900 rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => navigate('/issues/new')}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2.5"
                    role="menuitem"
                  >
                    <IconEdit className="w-4 h-4 text-gray-500" /> Create an Issue
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/polls/new')}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2.5"
                    role="menuitem"
                  >
                    <IconPolls className="w-4 h-4 text-gray-500" /> Create a Poll
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Bottom: avatar or login */}
        <div className="p-3">
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="w-full flex items-center gap-3 rounded-full px-2 py-2 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 transition"
                title="Open profile menu"
              >
                <span className="relative inline-block">
                  <Avatar name={user.name} size="sm" src={avatarSrc} />
                  {!user.verified && (
                    <span
                      title="Not verified"
                      className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-400 rounded-full ring-2 ring-white flex items-center justify-center"
                    >
                      <IconAlert className="w-2.5 h-2.5 text-white" />
                    </span>
                  )}
                </span>
                <span className="flex-1 text-left min-w-0">
                  <span className="block text-sm font-semibold truncate text-gray-900">{user.name}</span>
                  <span className="block text-[11px] text-gray-500 truncate">{user.phone}</span>
                </span>
                <IconDots className="w-4 h-4 text-gray-400 shrink-0" />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute left-full bottom-0 ml-2 w-56 bg-white text-gray-900 rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="font-semibold truncate">{user.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user.phone}</p>
                  </div>
                  <Link href="/profile" onClick={() => setMenuOpen(false)} className="px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2.5" role="menuitem">
                    <IconUser className="w-4 h-4 text-gray-500" /> My profile
                  </Link>
                  <Link href="/issues/mine" onClick={() => setMenuOpen(false)} className="px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2.5" role="menuitem">
                    <IconClipboard className="w-4 h-4 text-gray-500" /> My issues
                  </Link>
                  <Link href="/issues/new" onClick={() => setMenuOpen(false)} className="px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2.5" role="menuitem">
                    <IconEdit className="w-4 h-4 text-gray-500" /> Raise an issue
                  </Link>
                  <button onClick={logout} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-gray-50 border-t border-gray-100 flex items-center gap-2.5" role="menuitem">
                    <IconLogOut className="w-4 h-4" /> Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Link href="/login" className="block text-center px-3 py-2 rounded-full hover:bg-gray-100 text-sm text-gray-800 transition">
                Login
              </Link>
              <Link
                href="/register"
                className="block text-center bg-saffron text-navy px-3 py-2 rounded-full font-semibold text-sm hover:opacity-90 transition"
              >
                Get Verified
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* ---------- MOBILE: top strip (< md) ---------- */}
      <header className="md:hidden sticky top-0 bg-white/90 backdrop-blur border-b border-gray-100 z-30">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Link href="/" className="shrink-0 flex items-center">
            <img src="/logo.png" alt="Nagrik Awaaz" className="h-7 w-auto" />
          </Link>
          <div className="flex-1 min-w-0">
            <GlobalSearch />
          </div>
        </div>
      </header>

      {/* ---------- MOBILE: bottom tab bar (< md) ---------- */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-white/95 backdrop-blur border-t border-gray-200 z-40 flex justify-around items-center">
        <MobileTab href="/" icon={<IconHome />} label="Home" active={pathname === '/'} />
        <div className="relative -mt-6" ref={mobileCreateRef}>
          <button
            type="button"
            onClick={() => setMobileCreateOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={mobileCreateOpen}
            aria-label="Create a new post"
            className="w-14 h-14 rounded-full bg-saffron text-navy shadow-lg flex items-center justify-center active:scale-95 transition"
          >
            <IconPlus className="w-6 h-6" />
          </button>
          {mobileCreateOpen && (
            <div
              role="menu"
              className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 bg-white text-gray-900 rounded-xl shadow-xl border border-gray-200 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => navigate('/issues/new')}
                className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-2.5"
                role="menuitem"
              >
                <IconEdit className="w-4 h-4 text-gray-500" />
                <span>Create an Issue</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/polls/new')}
                className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-2.5 border-t border-gray-100"
                role="menuitem"
              >
                <IconPolls className="w-4 h-4 text-gray-500" />
                <span>Create a Poll</span>
              </button>
            </div>
          )}
        </div>
        {user ? (
          <>
            <MobileTab href="/inbox" icon={<IconInbox />} label="Inbox" badge={pendingCount} active={pathname?.startsWith('/inbox')} />
            <MobileTab href="/notifications" icon={<IconBell />} label="Activity" badge={notifCount} active={pathname?.startsWith('/notifications')} />
            <div className="relative" ref={mobileMenuRef}>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={mobileMenuOpen}
                aria-label="Open profile menu"
                className="flex flex-col items-center justify-center gap-0.5 w-14 py-1"
              >
                <span className="relative inline-block">
                  <Avatar name={user.name} size="sm" src={avatarSrc} />
                  {!user.verified && (
                    <span
                      title="Not verified"
                      className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-400 rounded-full ring-2 ring-white flex items-center justify-center"
                    >
                      <IconAlert className="w-2 h-2 text-white" />
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-gray-700">Profile</span>
              </button>
              {mobileMenuOpen && (
                <div
                  role="menu"
                  className="absolute bottom-full right-0 mb-2 w-56 bg-white text-gray-900 rounded-xl shadow-xl border border-gray-200 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="font-semibold truncate">{user.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user.phone}</p>
                  </div>
                  <Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2.5" role="menuitem">
                    <IconUser className="w-4 h-4 text-gray-500" /> My profile
                  </Link>
                  <Link href="/issues/mine" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2.5" role="menuitem">
                    <IconClipboard className="w-4 h-4 text-gray-500" /> My issues
                  </Link>
                  <Link href="/issues/new" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2.5" role="menuitem">
                    <IconEdit className="w-4 h-4 text-gray-500" /> Raise an issue
                  </Link>
                  <Link href="/explore" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2.5" role="menuitem">
                    <IconSearch className="w-4 h-4 text-gray-500" /> Explore
                  </Link>
                  <Link href="/leaderboard" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2.5" role="menuitem">
                    <IconTrophy className="w-4 h-4 text-gray-500" /> Leaderboard
                  </Link>
                  {user.role === 'moderator' || user.role === 'admin' ? (
                    <Link href="/moderation" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2.5 border-t border-gray-100" role="menuitem">
                      <IconShield className="w-4 h-4 text-gray-500" /> Reported Posts
                    </Link>
                  ) : null}
                  {user.role === 'official' ? (
                    <Link href="/officials" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2.5 border-t border-gray-100" role="menuitem">
                      <IconLandmark className="w-4 h-4 text-gray-500" /> Official Dashboard
                    </Link>
                  ) : null}
                  <button onClick={logout} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-gray-50 border-t border-gray-100 flex items-center gap-2.5" role="menuitem">
                    <IconLogOut className="w-4 h-4" /> Log out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <MobileTab href="/login" icon={<IconKey />} label="Login" active={pathname === '/login'} />
            <Link href="/register" className="flex flex-col items-center justify-center gap-0.5 w-14 py-1">
              <IconCheckCircle className="w-6 h-6 text-gray-800" />
              <span className="text-[10px] text-gray-700">Join</span>
            </Link>
          </>
        )}
      </nav>
    </>
  );
}

// Content-width pill hover (not full-row) is what makes this read as
// "X.com-style" rather than a generic sidebar list — the highlight hugs the
// icon+label instead of stretching edge-to-edge.
function SidebarLink({ href, icon, label, badge, title, active }) {
  return (
    <Link
      href={href}
      className={`relative flex items-center gap-4 mx-2 my-0.5 px-3 py-2.5 rounded-full transition hover:bg-gray-100 ${
        active ? 'text-gray-900' : 'text-gray-800'
      }`}
      title={title || label}
    >
      <span className="relative w-6 h-6 flex items-center justify-center shrink-0" aria-hidden>
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-semibold">
            {badge}
          </span>
        )}
      </span>
      <span className={`text-[15px] ${active ? 'font-bold' : 'font-normal'}`}>{label}</span>
    </Link>
  );
}

function MobileTab({ href, icon, label, badge, active }) {
  return (
    <Link href={href} className="relative flex flex-col items-center justify-center gap-0.5 w-14 py-1">
      <span className={`relative w-6 h-6 flex items-center justify-center ${active ? 'text-gray-900' : 'text-gray-600'}`} aria-hidden>
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-semibold">
            {badge}
          </span>
        )}
      </span>
      <span className={`text-[10px] ${active ? 'text-gray-900 font-semibold' : 'text-gray-700'}`}>{label}</span>
    </Link>
  );
}

// ---- Outline icon set (Feather-style: 24x24, stroke-based, currentColor) ----
// Kept inline in this file rather than as a separate icons module, so this
// stays a single drop-in file. Each accepts a className for sizing/color.
function IconBase({ className = 'w-6 h-6', children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function IconHome({ className }) {
  return (
    <IconBase className={className}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" />
    </IconBase>
  );
}

function IconPolls({ className }) {
  return (
    <IconBase className={className}>
      <path d="M4 20V10" />
      <path d="M12 20V4" />
      <path d="M20 20v-7" />
    </IconBase>
  );
}

function IconSearch({ className }) {
  return (
    <IconBase className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </IconBase>
  );
}

function IconTrophy({ className }) {
  return (
    <IconBase className={className}>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4" />
      <path d="M17 5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4" />
    </IconBase>
  );
}

function IconInbox({ className }) {
  return (
    <IconBase className={className}>
      <path d="M3.5 12h4l1.5 3h6l1.5-3h4" />
      <path d="M5.2 6.4 3.5 12v6a1 1 0 0 0 1 1h15a1 1 0 0 0 1-1v-6l-1.7-5.6a1 1 0 0 0-1-.7H6.2a1 1 0 0 0-1 .7Z" />
    </IconBase>
  );
}

function IconBell({ className }) {
  return (
    <IconBase className={className}>
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" />
      <path d="M9.5 17a2.5 2.5 0 0 0 5 0" />
    </IconBase>
  );
}

function IconShield({ className }) {
  return (
    <IconBase className={className}>
      <path d="M12 3 5 6v5c0 4.5 3 7.7 7 10 4-2.3 7-5.5 7-10V6Z" />
      <path d="m9.5 12 1.8 1.8L14.8 10" />
    </IconBase>
  );
}

function IconLandmark({ className }) {
  return (
    <IconBase className={className}>
      <path d="M3 21h18" />
      <path d="M4 21V10" />
      <path d="M20 21V10" />
      <path d="M8 21v-6" />
      <path d="M12 21v-6" />
      <path d="M16 21v-6" />
      <path d="M2.5 10 12 4l9.5 6Z" />
    </IconBase>
  );
}

function IconPlus({ className }) {
  return (
    <IconBase className={className}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  );
}

function IconEdit({ className }) {
  return (
    <IconBase className={className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </IconBase>
  );
}

function IconUser({ className }) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" />
    </IconBase>
  );
}

function IconClipboard({ className }) {
  return (
    <IconBase className={className}>
      <rect x="5.5" y="4.5" width="13" height="16" rx="1.5" />
      <path d="M9 4.5V3.8A1.3 1.3 0 0 1 10.3 2.5h3.4A1.3 1.3 0 0 1 15 3.8v.7" />
      <path d="M8.5 11h7" />
      <path d="M8.5 15h7" />
    </IconBase>
  );
}

function IconLogOut({ className }) {
  return (
    <IconBase className={className}>
      <path d="M9 20H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4" />
      <path d="M16 17 21 12 16 7" />
      <path d="M21 12H9" />
    </IconBase>
  );
}

function IconDots({ className }) {
  return (
    <IconBase className={className}>
      <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

function IconAlert({ className }) {
  return (
    <IconBase className={className} strokeWidth="2.5">
      <path d="M12 8v4.5" />
      <circle cx="12" cy="16" r="0.6" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

function IconKey({ className }) {
  return (
    <IconBase className={className}>
      <circle cx="8" cy="15" r="3.5" />
      <path d="m10.5 12.5 8-8" />
      <path d="M16 7l2 2" />
      <path d="M19 4l1.5 1.5" />
    </IconBase>
  );
}

function IconCheckCircle({ className }) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.5 2.5L16 9.5" />
    </IconBase>
  );
}
