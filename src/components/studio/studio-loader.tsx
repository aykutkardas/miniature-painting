"use client";

import dynamic from "next/dynamic";
import { LoadingCard } from "./ui/loading-overlay";

export const StudioLoader = dynamic(() => import("./studio").then((m) => m.Studio), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <LoadingCard label="Setting up the workbench" />
    </div>
  ),
});
