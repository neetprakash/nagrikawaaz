'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar';
import { api, clearToken, getStoredUser, API_URL } from '../lib/api';
import GlobalSearch from './GlobalSearch';

export default function NavBar() {
  const [user, setUser] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const u = getStoredUser();
    setUser(u);
    if (!u) return;
    let cancelled = false;
    async function tick() {
      try {
        const res = await api.pendingRequests();
        if (!cancelled) setPendingCount(res.requests?.length || 0);
      } catch {
        // 401 just means the token expired — the user will be redirected on next action
      }
    }
    tick();
    const id = setInterval(tick, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  function logout() {
    clearToken();
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('civic_user');
      window.location.href = '/';
    }
  }

  const avatarSrc = user?.avatar_url
    ? user.avatar_url.startsWith('http')
      ? user.avatar_url
      : `${API_URL}${user.avatar_url}`
    : null;

  return (
    <header className="bg-navy text-white">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
        <Link href="/" className="font-bold text-lg flex items-center gap-2">
          <span className="text-saffron">Nagrik</span>
          <span className="text-indiagreen">Awaaz</span>
        </Link>

        {/* Centered search bar — the parent's flex puts it between brand and right-side nav.
            `flex-1` + justify-center lets it grow to fill, then centers within its lane. */}
        <div className="flex-1 flex justify-center order-3 md:order-2 w-full md:w-auto">
          <GlobalSearch />
        </div>

        <nav className="flex items-center gap-4 text-sm flex-wrap order-2 md:order-3">
          <Link href="/" className="hover:underline">Home</Link>
          <Link href="/polls" className="hover:underline">Polls</Link>
          {user ? (
            <Link href="/inbox" className="hover:underline relative">
              Inbox
              {pendingCount > 0 && (
                <span
                  className="absolute -top-1 -right-3 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center"
                  title={`${pendingCount} pending request${pendingCount === 1 ? '' : 's'}`}
                >
                  {pendingCount}
                </span>
              )}
            </Link>
          ) : null}
          {user ? (
            <Link href="/people" className="hover:underline relative">
              People
              {pendingCount > 0 && (
                <span
                  className="absolute -top-1 -right-3 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center"
                  title={`${pendingCount} pending request${pendingCount === 1 ? '' : 's'}`}
                >
                  {pendingCount}
                </span>
              )}
            </Link>
          ) : null}
          {user?.role === 'moderator' || user?.role === 'admin' ? (
            <Link href="/moderation" className="hover:underline">Reported Posts</Link>
          ) : null}
          {user?.role === 'official' ? (
            <Link href="/officials" className="hover:underline">Official Dashboard</Link>
          ) : null}

          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="rounded-full focus:outline-none focus:ring-2 focus:ring-white/40"
                title="Open profile menu"
              >
                <Avatar name={user.name} size="sm" src={avatarSrc} />
                {!user.verified && (
                  <span
                    title="Not verified"
                    className="absolute -top-0.5 -right-0.5 text-[10px]"
                  >
                    ⚠️
                  </span>
                )}
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 bg-white text-gray-900 rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="font-semibold truncate">{user.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user.phone}</p>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm hover:bg-gray-50"
                    role="menuitem"
                  >
                    👤 My profile
                  </Link>
                  <Link
                    href="/issues/mine"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm hover:bg-gray-50"
                    role="menuitem"
                  >
                    📋 My issues
                  </Link>
                  <Link
                    href="/issues/new"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm hover:bg-gray-50"
                    role="menuitem"
                  >
                    ✍️ Raise an issue
                  </Link>
                  <button
                    onClick={logout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 border-t border-gray-100"
                    role="menuitem"
                  >
                    🚪 Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className="hover:underline">Login</Link>
              <Link
                href="/register"
                className="bg-saffron text-navy px-3 py-1 rounded-lg font-semibold"
              >
                Get Verified
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}