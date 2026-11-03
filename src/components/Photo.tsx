"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type PhotoInfo = { url: string; page: string | null } | null;
const memo = new Map<string, PhotoInfo>();

/** A real photo from Wikipedia for a city or landmark. Falls back to a gradient, never a fake image. */
export function Photo({
  title,
  className,
  children,
  fallbackHue = 160,
}: {
  title: string;
  className?: string;
  children?: React.ReactNode;
  fallbackHue?: number;
}) {
  // Results are keyed by title so a stale fetch never shows the wrong photo.
  const [fetched, setFetched] = useState<{ title: string; photo: PhotoInfo } | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const photo = memo.has(title) ? memo.get(title) : fetched?.title === title ? fetched.photo : undefined;
  const loaded = Boolean(photo?.url && loadedUrl === photo.url);
  useEffect(() => {
    if (!title || memo.has(title)) return;
    let alive = true;
    fetch(`/api/photo?title=${encodeURIComponent(title)}`)
      .then((r) => r.json())
      .then((j) => {
        memo.set(title, j.photo);
        if (alive) setFetched({ title, photo: j.photo });
      })
      .catch(() => memo.set(title, null));
    return () => {
      alive = false;
    };
  }, [title]);
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ background: `linear-gradient(135deg, hsl(${285 + (fallbackHue % 40)} 38% 18%), hsl(${305 + (fallbackHue % 30)} 36% 36%) 60%, hsl(${270 + (fallbackHue % 50)} 20% 72%))` }}
    >
      {photo?.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.url}
          alt={title}
          onLoad={() => setLoadedUrl(photo.url)}
          className={cn("absolute inset-0 size-full object-cover transition-opacity duration-1000", loaded ? "opacity-100" : "opacity-0")}
        />
      )}
      {children}
    </div>
  );
}
