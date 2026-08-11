'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Avatar from '../../../components/Avatar';
import { api, getStoredUser, getToken, API_URL, WS_URL } from '../../../lib/api';

function absoluteAvatarUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
}

export default function ThreadPage() {
  const router = useRouter();
  const params = useParams();
  const otherId = Number(params?.userId);
  const [other, setOther] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [status, setStatus] = useState('connecting'); // connecting | open | reconnecting | closed
  const [error, setError] = useState('');
  const wsRef = useRef(null);
  const reconnectAttempt = useRef(0);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace('/login');
      return;
    }
    if (!otherId) return;
    load();
    return () => closeSocket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  async function load() {
    setError('');
    try {
      const res = await api.messages(otherId);
      setMessages(res.messages || []);
      // The other-user info isn't in the messages endpoint — pull it from
      // the threads list (cheap: the user is in our inbox anyway).
      const t = await api.threads();
      const found = (t.threads || []).find((x) => x.other_user.id === otherId);
      if (found) setOther(found.other_user);
      openSocket();
    } catch (err) {
      setError(err.message);
    }
  }

  function openSocket() {
    const token = getToken();
    if (!token) return;
    closeSocket();
    const ws = new WebSocket(`${WS_URL}/ws?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => {
      reconnectAttempt.current = 0;
      setStatus('open');
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'message') {
          const m = msg.message;
          if (m.sender_id === otherId || m.recipient_id === otherId) {
            setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
          }
        }
      } catch {
        // ignore malformed
      }
    };
    ws.onerror = () => {
      // The close handler will run right after.
    };
    ws.onclose = () => {
      if (wsRef.current !== ws) return; // intentional close
      setStatus('reconnecting');
      const delay = Math.min(15000, 500 * 2 ** reconnectAttempt.current);
      reconnectAttempt.current += 1;
      setTimeout(() => {
        if (wsRef.current === ws) openSocket();
      }, delay);
    };
  }

  function closeSocket() {
    const ws = wsRef.current;
    if (!ws) return;
    wsRef.current = null;
    try {
      ws.close();
    } catch {}
  }

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText('');
    // Optimistic append — the WS will echo back the canonical row, deduped by id.
    const tempId = `tmp-${Date.now()}`;
    const me = getStoredUser();
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        sender_id: me?.id,
        recipient_id: otherId,
        body,
        created_at: new Date().toISOString(),
        read_at: null,
      },
    ]);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'send', to: otherId, body }));
    } else {
      // Socket isn't up — fall back to REST so the user isn't blocked.
      try {
        const res = await api.sendMessage(otherId, body);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? res.message : m))
        );
      } catch (err) {
        setError(err.message);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    }
  }

  if (error) return <p className="text-red-600 max-w-xl mx-auto">{error}</p>;

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-160px)]">
      <div className="flex items-center gap-3 pb-3 border-b">
        <Link href="/inbox" className="text-sm text-gray-500 hover:underline">
          ← Inbox
        </Link>
        {other ? (
          <>
            <Avatar name={other.name} src={absoluteAvatarUrl(other.avatar_url)} />
            <div className="flex-1 min-w-0">
              <p className="font-medium">{other.name}</p>
              <p className="text-xs text-gray-500">
                {status === 'open' && '● online'}
                {status === 'connecting' && '○ connecting…'}
                {status === 'reconnecting' && '○ reconnecting…'}
                {status === 'closed' && '○ offline'}
              </p>
            </div>
          </>
        ) : (
          <p className="text-gray-500 text-sm">Loading…</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-gray-400 text-sm text-center mt-8">
            No messages yet. Say hi 👋
          </p>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} mine={m.sender_id !== otherId} text={m.body} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={send} className="pt-3 border-t flex gap-2">
        <input
          className="input flex-1"
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={!text.trim() || status === 'connecting'}
        >
          Send
        </button>
      </form>
    </div>
  );
}

function MessageBubble({ mine, text }) {
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-1.5 text-sm ${
          mine ? 'bg-navy text-white' : 'bg-gray-100 text-gray-900'
        }`}
      >
        {text}
      </div>
    </div>
  );
}