'use client';

import { useState } from 'react';
import Avatar from './Avatar';
import { api, getStoredUser } from '../lib/api';
import { timeAgo } from '../lib/time';

export default function PetitionFeedCard({ petition: initial }) {
  const [petition, setPetition] = useState(initial);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState('');

  const pct = Math.min(100, Math.round((petition.signature_count / petition.target_signatures) * 100));

  async function sign() {
    if (signed) return;
    try {
      const res = await api.signPetition(petition.id);
      setPetition((p) => ({ ...p, signature_count: res.signature_count }));
      setSigned(true);
    } catch (err) {
      if (!getStoredUser()) setError('Login to sign this petition');
      else setError(err.message);
    }
  }

  return (
    <article className="card border-l-4 border-l-indiagreen">
      <div className="flex items-start gap-3">
        <Avatar name="Petition" />
        <div className="flex-1">
          <span className="font-semibold text-sm">✍️ Petition</span>
          <div className="text-xs text-gray-500">{timeAgo(petition.created_at)}</div>
        </div>
      </div>

      <h3 className="font-semibold text-navy mt-3">{petition.title}</h3>
      <p className="text-sm text-gray-700 mt-1 line-clamp-3">{petition.description}</p>

      <div className="mt-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{petition.signature_count} / {petition.target_signatures} signatures</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-indiagreen transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <button
        onClick={sign}
        disabled={signed}
        className={`mt-3 w-full py-2 rounded-lg text-sm font-medium ${
          signed ? 'bg-green-50 text-indiagreen' : 'btn-primary'
        }`}
      >
        {signed ? '✅ Signed' : 'Sign this petition'}
      </button>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </article>
  );
}
