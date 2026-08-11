'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStoredUser } from '../lib/api';

export default function HomePage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (getStoredUser()) {
      router.replace('/dashboard');
    } else {
      setChecked(true);
    }
  }, [router]);

  if (!checked) return null; // avoid flashing the marketing page for logged-in users

  return (
    <div className="space-y-12">
      <section className="text-center py-10">
        <h1 className="text-4xl font-bold text-navy mb-3">
          Real Citizens. Real Issues. Real Accountability.
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto mb-6">
          Ask your MP directly, vote on the problems that affect your ward, district, state or
          country — and watch officials respond in public. No bots, no anonymous trolling, no
          viral noise. Free, forever, like the apps you already use.
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/register" className="btn-primary">Get Verified &amp; Join</Link>
          <Link href="/dashboard" className="btn-secondary">Browse the Feed</Link>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        <Pillar
          title="Genuine Users Only"
          body="Every account is tied to a real phone number and Voter ID, reviewed before you can vote or raise an issue. No fake accounts, no bots."
        />
        <Pillar
          title="Post Instantly, Community Moderated"
          body="Your post goes live the moment you share it — just like Instagram or Facebook. Citizens flag spam or abuse directly; posts that get reported enough go to a moderator for review."
        />
        <Pillar
          title="Local Accountability"
          body="Every issue is tagged to a ward, city, district, state or national official, and their response is tracked on a public timeline."
        />
      </section>

      <section className="card">
        <h2 className="font-semibold text-lg mb-3">How escalation works</h2>
        <p className="text-sm text-gray-600 mb-4">
          Support (votes) aren't just a counter — they automatically escalate an issue up the
          chain, so it becomes impossible to quietly ignore.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Threshold votes="100" who="Ward Officer" color="badge-ward" />
          <Threshold votes="1,000" who="City Authority" color="badge-city" />
          <Threshold votes="10,000" who="State Department" color="badge-state" />
          <Threshold votes="50,000" who="National Attention" color="badge-national" />
        </div>
      </section>
    </div>
  );
}

function Pillar({ title, body }) {
  return (
    <div className="card">
      <h3 className="font-semibold text-navy mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{body}</p>
    </div>
  );
}

function Threshold({ votes, who, color }) {
  return (
    <div className="border rounded-lg p-3 text-center">
      <div className="font-bold text-navy">{votes} votes</div>
      <span className={`badge ${color} mt-1`}>{who}</span>
    </div>
  );
}
