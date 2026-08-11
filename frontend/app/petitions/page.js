'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function PetitionsPage() {
  const [petitions, setPetitions] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await api.listPetitions();
      setPetitions(res.petitions);
    } catch (err) {
      setError(err.message);
    }
  }

  async function sign(id) {
    try {
      await api.signPetition(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy mb-4">Petitions</h1>
      {error && <p className="text-red-600 mb-2">{error}</p>}
      <div className="space-y-4">
        {petitions.map((p) => {
          const pct = Math.min(100, Math.round((p.signature_count / p.target_signatures) * 100));
          return (
            <div key={p.id} className="card">
              <h3 className="font-semibold text-navy">{p.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{p.description}</p>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{p.signature_count} / {p.target_signatures} signatures</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indiagreen" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <button onClick={() => sign(p.id)} className="btn-primary mt-3">Sign this petition</button>
            </div>
          );
        })}
        {petitions.length === 0 && <p className="text-gray-500">No petitions yet.</p>}
      </div>
    </div>
  );
}
