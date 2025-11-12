"use client";

import Image from "next/image";

export function FamilyFeudHeader() {
  return (
    <div className="flex items-center justify-center py-4">
      <div className="relative">
        <Image
          src="/Logo_of_Family_Feud.png"
          alt="Family Feud"
          width={220}
          height={80}
          priority
          className="drop-shadow-[0_0_20px_rgba(255,120,0,0.3)]"
        />
      </div>
    </div>
  );
}
