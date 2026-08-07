/**
 * Boot curtain — covers the desktop until the restore settles.
 *
 * PC showed a similar screen while it rehydrated from IndexedDB. Here it
 * covers the window between the local restore (instant) and the server
 * reconcile, so windows do not visibly jump into place if the server copy
 * turns out to be different.
 */
import { Monitor } from "lucide-react";

export function BootScreen() {
  return (
    <div className="pc-boot-curtain fixed inset-0 z-[4000] flex flex-col items-center justify-center gap-4 bg-black text-zinc-300">
      <Monitor size={34} className="text-os-accent" />
      <div className="text-sm font-medium tracking-wide">Momentum PC</div>
      <div className="h-0.5 w-40 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full w-1/3 animate-[pc-boot-slide_1.1s_ease-in-out_infinite] rounded-full bg-os-accent" />
      </div>
      <div className="text-[11px] text-zinc-600">Restoring your desktop…</div>
      <style>{`
        @keyframes pc-boot-slide {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
      `}</style>
    </div>
  );
}

export default BootScreen;
