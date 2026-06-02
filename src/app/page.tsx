import { Suspense } from "react";

import { WorksheetCommandCenter } from "@/features/worksheet/command-center";

export default function Home() {
  return (
    <Suspense fallback={<main className="command-loading">Loading…</main>}>
      <WorksheetCommandCenter />
    </Suspense>
  );
}
