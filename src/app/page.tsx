import PaintingBoard from "./components/painting-board";
import FooterLinks from "./components/footer-links";

export default function Home() {
  return (
    <div
      className="w-screen h-screen relative overflow-hidden"
      style={{
        backgroundImage: "url('/desk.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Blur overlay on the wooden desk */}
      <div
        className="absolute inset-0"
        style={{ backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      />

      {/* Center the blueprint card in the full viewport */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ zIndex: 1 }}
      >
        {/* Blueprint card — 80% of the viewport, sidebar sits inside it via flex */}
        <div
          className="relative"
          style={{
            width: "80%",
            height: "80%",
            background: "#0a1628",
            backgroundImage: `
              linear-gradient(rgba(65, 155, 249, 0.18) 1px, transparent 1px),
              linear-gradient(90deg, rgba(65, 155, 249, 0.18) 1px, transparent 1px),
              linear-gradient(rgba(65, 155, 249, 0.07) 1px, transparent 1px),
              linear-gradient(90deg, rgba(65, 155, 249, 0.07) 1px, transparent 1px)
            `,
            backgroundSize: "80px 80px, 80px 80px, 20px 20px, 20px 20px",
            backgroundPosition: "-1px -1px, -1px -1px, -1px -1px, -1px -1px"
          }}
        >
          {/* Blueprint corner markers */}
          {/* Top-left */}
          <div className="absolute top-6 left-6 w-10 h-10 border-l-2 border-t-2" style={{ borderColor: "rgba(65,155,249,0.5)" }} />
          {/* Top-right */}
          <div className="absolute top-6 right-6 w-10 h-10 border-r-2 border-t-2" style={{ borderColor: "rgba(65,155,249,0.5)" }} />
          {/* Bottom-left */}
          <div className="absolute bottom-6 left-6 w-10 h-10 border-l-2 border-b-2" style={{ borderColor: "rgba(65,155,249,0.5)" }} />
          {/* Bottom-right */}
          <div className="absolute bottom-6 right-6 w-10 h-10 border-r-2 border-b-2" style={{ borderColor: "rgba(65,155,249,0.5)" }} />

          {/* Blueprint label top */}
          <div className="absolute top-7 left-1/2 -translate-x-1/2 flex items-center gap-3" style={{ zIndex: 10 }}>
            <div className="h-px w-16" style={{ background: "rgba(65,155,249,0.4)" }} />
            <span className="text-xs tracking-[0.25em] uppercase font-mono" style={{ color: "rgba(65,155,249,0.6)" }}>
              Miniature Painting Studio
            </span>
            <div className="h-px w-16" style={{ background: "rgba(65,155,249,0.4)" }} />
          </div>

          {/* PaintingBoard: canvas (flex-1) + sidebar (220px) in a flex row */}
          <PaintingBoard />
        </div>
      </div>

      {/* Footer links */}
      <FooterLinks />
    </div>
  );
}
