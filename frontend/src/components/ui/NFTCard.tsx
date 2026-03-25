"use client";

import Image from "next/image";

interface NFTCardProps {
  id: string;
  name?: string;
  thumbnail?: string;
  collectionName: string;
  isSelected: boolean;
  onToggle: () => void;
}

export function NFTCard({
  id,
  name,
  thumbnail,
  collectionName,
  isSelected,
  onToggle,
}: NFTCardProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        "group relative flex w-full flex-col overflow-hidden rounded-card border bg-white text-left transition-all duration-[250ms] ease-in-out",
        isSelected
          ? "border-brand-orange shadow-orange-glow scale-[1.005]"
          : "border-[rgba(66,87,138,0.15)] hover:border-[rgba(97,106,136,0.30)] hover:shadow-card",
      ].join(" ")}
    >
      {/* Thumbnail */}
      <div className="relative aspect-square w-full bg-gray-100">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={name ?? `NFT #${id}`}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <svg
              className="h-10 w-10 text-gray-300"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 4a3 3 0 110 6 3 3 0 010-6zm0 14a8 8 0 01-6.195-2.95C7.2 14.81 9.505 14 12 14s4.8.81 6.195 3.05A8 8 0 0112 20z" />
            </svg>
          </div>
        )}

        {/* Selected checkmark overlay */}
        {isSelected && (
          <div className="absolute inset-0 flex items-center justify-center bg-brand-orange/20">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-orange text-white shadow-md">
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-3 py-2">
        <p className="truncate text-xs font-medium text-brand-dark">
          {name ?? `#${id}`}
        </p>
        <p className="truncate text-xs text-gray-500">{collectionName}</p>
      </div>
    </button>
  );
}
