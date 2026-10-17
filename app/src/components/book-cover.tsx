"use client";

import { useState } from "react";
import { coverSrc } from "@/lib/book-labels";

// Couverture du livre ; à défaut, une vignette avec le titre (même format 2:3).
export function BookCover({
  id,
  version,
  hasCover,
  title,
  author,
  size = "md",
}: {
  id: number;
  version: string;
  hasCover: boolean;
  title: string;
  author: string;
  size?: "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const box = size === "sm" ? "w-10" : size === "lg" ? "w-36" : "w-full";

  if (!hasCover || failed) {
    return (
      <div
        className={`${box} flex aspect-[2/3] flex-col justify-between overflow-hidden rounded-md bg-accent/15 p-1.5 text-accent`}
        aria-label={`Pas de couverture pour ${title}`}
      >
        {size !== "sm" && (
          <>
            <span className="line-clamp-4 text-[11px] font-semibold leading-tight">{title}</span>
            <span className="line-clamp-2 text-[10px] opacity-80">{author}</span>
          </>
        )}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={coverSrc(id, version)}
      alt={`Couverture de ${title}`}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${box} aspect-[2/3] rounded-md bg-surface object-cover shadow-sm`}
    />
  );
}
