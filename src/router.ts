export type Route = { name: "home" } | { name: "checklist"; id: string };

const checklistPattern = /^#\/checklist\/([^/]+)$/;

export function parseHash(hash: string): Route {
  if (hash === "" || hash === "#" || hash === "#/") {
    return { name: "home" };
  }

  const match = checklistPattern.exec(hash);
  const id = match?.[1];

  if (!id) {
    return { name: "home" };
  }

  try {
    return { name: "checklist", id: decodeURIComponent(id) };
  } catch {
    return { name: "home" };
  }
}

export function checklistHash(id: string): string {
  return `#/checklist/${encodeURIComponent(id)}`;
}
