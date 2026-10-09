import { StudioLoader } from "@/components/studio/studio-loader";

export default function Home() {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <h1 className="sr-only">Miniature Studio</h1>
      <StudioLoader />
    </main>
  );
}
