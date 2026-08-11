'use client';

import Link from 'next/link';
import Avatar from './Avatar';

export default function PostComposer({ user }) {
  return (
    <div className="card flex items-center gap-3">
      <Avatar name={user?.name || '?'} />
      <Link
        href="/issues/new"
        className="flex-1 bg-gray-100 hover:bg-gray-200 transition rounded-full px-4 py-2.5 text-sm text-gray-500"
      >
        {user ? "What's happening in your area?" : 'Login to raise an issue in your area…'}
      </Link>
      <Link href="/issues/new" className="btn-primary hidden sm:inline-block">
        + Raise Issue
      </Link>
    </div>
  );
}
