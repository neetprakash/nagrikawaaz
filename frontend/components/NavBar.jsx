'use client';

import Link from 'next/link';
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
      <SidebarLink href="/" icon="🏠" label="Home" />
      <SidebarLink href="/polls" icon="📊" label="Polls" />
      {user && <SidebarLink href="/inbox" icon="📨" label="Inbox" badge={pendingCount} title="pending requests" />}
      {user && <SidebarLink href="/notifications" icon="🔔" label="Notifications" badge={notifCount} title="unread" />}
      {user && (user.role === 'moderator' || user.role === 'admin') && (
        <SidebarLink href="/moderation" icon="🛡️" label="Reported Posts" />
      )}
      {user && user.role === 'official' && (
        <SidebarLink href="/officials" icon="🏛️" label="Official Dashboard" />
      )}
    </>
  );

  return (
    <>
      {/* ---------- DESKTOP: fixed left sidebar (md+) ---------- */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 bg-navy text-white flex-col z-40">
        <Link href="/" className="px-5 py-5 border-b border-white/10">
          <div className="text-xl font-bold leading-tight">
            <span className="text-saffron">Nagrik</span>{' '}
            <span className="text-indiagreen">Awaaz</span>
          </div>
          <p className="text-[10px] text-white/60 mt-1 tracking-wide uppercase">
            Citizen Accountability
          </p>
        </Link>

        <div className="px-3 py-3 border-b border-white/10">
          <GlobalSearch />
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {desktopNavItems}

          {user && (
            <div className="relative px-3 mt-2" ref={createRef}>
              <button
                type="button"
                onClick={() => setCreateOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={createOpen}
                className="w-full bg-saffron text-navy px-3 py-2 rounded-lg font-semibold hover:opacity-90 flex items-center gap-2"
                title="Create a new post"
              >
                <span>+</span>
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
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                    role="menuitem"
                  >
                    ✍️ Create an Issue
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/polls/new')}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                    role="menuitem"
                  >
                    📊 Create a Poll
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Bottom: avatar or login */}
        <div className="border-t border-white/10 p-3">
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="w-full flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
                title="Open profile menu"
              >
                <span className="relative inline-block">
                  <Avatar name={user.name} size="sm" src={avatarSrc} />
                  {!user.verified && (
                    <span title="Not verified" className="absolute -top-0.5 -right-0.5 text-[10px]">
                      ⚠️
                    </span>
                  )}
                </span>
                <span className="flex-1 text-left min-w-0">
                  <span className="block text-sm font-semibold truncate">{user.name}</span>
                  <span className="block text-[10px] text-white/60 truncate">{user.phone}</span>
                </span>
                <span aria-hidden className="text-white/60 text-xs">⋯</span>
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
                  <Link href="/profile" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm hover:bg-gray-50" role="menuitem">
                    👤 My profile
                  </Link>
                  <Link href="/issues/mine" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm hover:bg-gray-50" role="menuitem">
                    📋 My issues
                  </Link>
                  <Link href="/issues/new" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm hover:bg-gray-50" role="menuitem">
                    ✍️ Raise an issue
                  </Link>
                  <button onClick={logout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 border-t border-gray-100" role="menuitem">
                    🚪 Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Link href="/login" className="block text-center px-3 py-2 rounded-lg hover:bg-white/10 text-sm">
                Login
              </Link>
              <Link
                href="/register"
                className="block text-center bg-saffron text-navy px-3 py-2 rounded-lg font-semibold text-sm"
              >
                Get Verified
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* ---------- MOBILE: top strip (< md) ---------- */}
      <header className="md:hidden sticky top-0 bg-navy text-white z-30 shadow">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/" className="font-bold text-lg flex items-center gap-2 shrink-0">
            <span className="text-saffron">Nagrik</span>
            <span className="text-indiagreen">Awaaz</span>
          </Link>
          <div className="flex-1 min-w-0">
            <GlobalSearch />
          </div>
        </div>
      </header>

      {/* ---------- MOBILE: bottom tab bar (< md) ---------- */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-white border-t border-gray-200 shadow-lg z-40 flex justify-around items-center">
        <MobileTab href="/" icon="🏠" label="Home" />
        <div className="relative -mt-6" ref={mobileCreateRef}>
          <button
            type="button"
            onClick={() => setMobileCreateOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={mobileCreateOpen}
            aria-label="Create a new post"
            className="w-14 h-14 rounded-full bg-saffron text-navy shadow-lg flex items-center justify-center text-2xl font-bold active:scale-95 transition"
          >
            +
          </button>
          {mobileCreateOpen && (
            <div
              role="menu"
              className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 bg-white text-gray-900 rounded-xl shadow-xl border border-gray-200 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => navigate('/issues/new')}
                className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-2"
                role="menuitem"
              >
                <span>✍️</span>
                <span>Create an Issue</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/polls/new')}
                className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100"
                role="menuitem"
              >
                <span>📊</span>
                <span>Create a Poll</span>
              </button>
            </div>
          )}
        </div>
        {user ? (
          <>
            <MobileTab href="/inbox" icon="📨" label="Inbox" badge={pendingCount} />
            <MobileTab href="/notifications" icon="🔔" label="Activity" badge={notifCount} />
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
                    <span title="Not verified" className="absolute -top-0.5 -right-0.5 text-[8px]">
                      ⚠️
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
                  <Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-sm hover:bg-gray-50" role="menuitem">
                    👤 My profile
                  </Link>
                  <Link href="/issues/mine" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-sm hover:bg-gray-50" role="menuitem">
                    📋 My issues
                  </Link>
                  <Link href="/issues/new" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-sm hover:bg-gray-50" role="menuitem">
                    ✍️ Raise an issue
                  </Link>
                  {user.role === 'moderator' || user.role === 'admin' ? (
                    <Link href="/moderation" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-sm hover:bg-gray-50 border-t border-gray-100" role="menuitem">
                      🛡️ Reported Posts
                    </Link>
                  ) : null}
                  {user.role === 'official' ? (
                    <Link href="/officials" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-sm hover:bg-gray-50 border-t border-gray-100" role="menuitem">
                      🏛️ Official Dashboard
                    </Link>
                  ) : null}
                  <button onClick={logout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 border-t border-gray-100" role="menuitem">
                    🚪 Log out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <MobileTab href="/login" icon="🔑" label="Login" />
            <Link href="/register" className="flex flex-col items-center justify-center gap-0.5 w-14 py-1">
              <span className="text-xl" aria-hidden>✅</span>
              <span className="text-[10px] text-gray-700">Join</span>
            </Link>
          </>
        )}
      </nav>
    </>
  );
}

function SidebarLink({ href, icon, label, badge, title }) {
  return (
    <Link
      href={href}
      className="relative flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-white/10 transition"
      title={title || label}
    >
      <span className="text-lg leading-none" aria-hidden>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span className="bg-red-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-semibold">
          {badge}
        </span>
      )}
    </Link>
  );
}

function MobileTab({ href, icon, label, badge }) {
  return (
    <Link href={href} className="relative flex flex-col items-center justify-center gap-0.5 w-14 py-1">
      <span className="relative text-xl" aria-hidden>
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-semibold">
            {badge}
          </span>
        )}
      </span>
      <span className="text-[10px] text-gray-700">{label}</span>
    </Link>
  );
}
