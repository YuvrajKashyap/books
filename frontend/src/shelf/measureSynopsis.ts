// Opt-in production measurement. Samples stay in this document and disappear on reload.
type TextPaint = PerformanceEntry & {
  identifier: string;
  paintTime?: number;
  presentationTime?: number;
  renderTime: number;
};

export function measure() {
  const output = document.createElement("output");
  output.id = "synopsis-timings";
  output.hidden = true;
  document.body.append(output);
  if (!PerformanceObserver.supportedEntryTypes.includes("element")) {
    output.textContent = "Element Timing unavailable";
    return;
  }
  let serial = 0;
  let mutation: MutationObserver | undefined;
  const pending = new Map<
    string,
    { direction: string; start: number; dom: number }
  >();
  const samples: {
    direction: string;
    dom: number;
    paint: number | null;
    presented: number | null;
    noteRequests: number;
  }[] = [];
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as TextPaint[]) {
      const click = pending.get(entry.identifier);
      if (!click) continue;
      pending.delete(entry.identifier);
      const presented = entry.presentationTime || entry.renderTime;
      samples.push({
        direction: click.direction,
        dom: click.dom - click.start,
        paint: entry.paintTime ? entry.paintTime - click.start : null,
        presented: presented ? presented - click.start : null,
        noteRequests: performance
          .getEntriesByType("resource")
          .filter(
            (resource) =>
              resource.name.includes("/book-notes/") &&
              resource.startTime >= click.start &&
              resource.startTime <= presented,
          ).length,
      });
    }
    output.textContent = JSON.stringify(samples);
    output.dataset.count = String(samples.length);
  });
  observer.observe({ type: "element", buffered: true });
  document.addEventListener(
    "click",
    (event) => {
      if (
        !event.isTrusted ||
        !(event.target instanceof Element) ||
        serial >= 64
      )
        return;
      const button = event.target.closest<HTMLButtonElement>(
        ".inspect-nav button",
      );
      const dialog = button?.closest("dialog");
      if (!dialog || !button || button.disabled) return;
      const previous = dialog.querySelector(".synopsis-lead");
      const id = "synopsis-" + ++serial;
      mutation?.disconnect();
      mutation = new MutationObserver(() => {
        const lead = dialog.querySelector(".synopsis-lead");
        if (!lead || lead === previous) return;
        pending.set(id, {
          direction: button.textContent!.trim(),
          start: event.timeStamp,
          dom: performance.now(),
        });
        lead.setAttribute("elementtiming", id);
        mutation?.disconnect();
      });
      mutation.observe(dialog, { subtree: true, childList: true });
    },
    true,
  );
}
