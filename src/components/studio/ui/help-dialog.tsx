"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { MOD } from "./top-bar";

const GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: "Painting",
    items: [
      { keys: ["Drag on model"], label: "Paint" },
      { keys: ["B"], label: "Brush" },
      { keys: ["E"], label: "Strip to primer" },
      { keys: ["I"], label: "Pick paint" },
      { keys: ["Alt"], label: "Hold to pick paint" },
      { keys: ["["], label: "Smaller brush" },
      { keys: ["]"], label: "Bigger brush" },
      { keys: ["1", "–", "4"], label: "Matte / Satin / Gloss / Metal" },
    ],
  },
  {
    title: "View",
    items: [
      { keys: ["Drag background"], label: "Orbit" },
      { keys: ["Space"], label: "Hold to orbit anywhere" },
      { keys: ["Right drag"], label: "Pan" },
      { keys: ["Scroll"], label: "Zoom" },
      { keys: ["F"], label: "Reset view" },
    ],
  },
  {
    title: "History",
    items: [
      { keys: [MOD, "Z"], label: "Undo" },
      { keys: [MOD, "⇧", "Z"], label: "Redo" },
      { keys: [MOD, "S"], label: "Save photo" },
    ],
  },
];

export function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>How to paint</DialogTitle>
          <DialogDescription>
            Your miniature starts in grey primer. Strokes wrap around the whole model, and your work is
            saved in this browser automatically. On touch screens, drag on the model to paint and pinch
            to zoom.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 sm:grid-cols-2">
          {GROUPS.map((group) => (
            <section key={group.title} className="flex flex-col gap-2">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{group.title}</h3>
              <dl className="flex flex-col gap-1.5">
                {group.items.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-4 text-sm">
                    <dt>{item.label}</dt>
                    <dd className="flex shrink-0 items-center gap-1 text-muted-foreground">
                      {item.keys.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
