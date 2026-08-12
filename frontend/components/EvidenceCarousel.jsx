'use client';

import { useRef, useState } from 'react';
import { API_URL } from '../lib/api';

function absoluteUrl(url) {
  if (!url) return url;
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
}

function isImage(item) {
  if (item.file_type && item.file_type.startsWith('image/')) return true;
  const lower = (item.file_url || '').toLowerCase();
  return /\.(png|jpe?g|gif|webp|avif|heic|heif|bmp|svg)(\?|$)/.test(lower);
}

function fileName(url) {
  if (!url) return 'file';
  const cleaned = url.split('?')[0].split('#')[0];
  return cleaned.split('/').pop() || 'file';
}

export default function EvidenceCarousel({ items = [] }) {
  const [index, setIndex] = useState(0);
  const trackRef = useRef(null);

  if (!items.length) return null;

  const total = items.length;

  function go(delta) {
    setIndex((i) => (i + delta + total) % total);
  }

  function goTo(i) {
    setIndex(i);
    const el = trackRef.current;
    if (el) {
      const child = el.children[i];
      if (child) child.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  const images = items.filter(isImage);
  const files = items.filter((it) => !isImage(it));

  return (
    <div className="mt-3 space-y-3">
      {images.length > 0 && (
        <div className="relative">
          <div
            ref={trackRef}
            className="flex gap-2 overflow-x-auto snap-x snap-mandatory scroll-smooth rounded-lg bg-gray-100"
            onScroll={(e) => {
              const el = e.currentTarget;
              const w = el.clientWidth;
              if (!w) return;
              const i = Math.round(el.scrollLeft / w);
              if (i !== index) setIndex(i);
            }}
          >
            {images.map((it, i) => (
              <a
                key={`img-${i}`}
                href={absoluteUrl(it.file_url)}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 w-full snap-center flex items-center justify-center"
                style={{ aspectRatio: '4 / 3' }}
              >
                <img
                  src={absoluteUrl(it.file_url)}
                  alt={fileName(it.file_url)}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={() => go(-1)}
                className="absolute top-1/2 left-2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 rounded-full w-8 h-8 flex items-center justify-center shadow"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={() => go(1)}
                className="absolute top-1/2 right-2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 rounded-full w-8 h-8 flex items-center justify-center shadow"
              >
                ›
              </button>
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Go to image ${i + 1}`}
                    onClick={() => goTo(i)}
                    className={`w-2 h-2 rounded-full transition ${
                      i === index ? 'bg-white' : 'bg-white/50 hover:bg-white/80'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((it, i) => (
            <li key={`file-${i}`}>
              <a
                href={absoluteUrl(it.file_url)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-navy hover:underline bg-gray-50 rounded-lg px-3 py-2"
              >
                <span aria-hidden>📄</span>
                <span className="truncate">{fileName(it.file_url)}</span>
                <span className="ml-auto text-xs text-gray-500">open</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
