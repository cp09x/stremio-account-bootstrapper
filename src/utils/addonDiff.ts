export interface AddonLike {
  transportUrl?: string;
  manifest?: {
    id?: string;
    name?: string;
  };
  name?: string;
}

export interface AddonDiffResult {
  added: string[];
  removed: string[];
  kept: string[];
  reordered: boolean;
}

export function getAddonDisplayName(
  addon: AddonLike | null | undefined
): string {
  return (
    addon?.manifest?.name ||
    addon?.name ||
    addon?.manifest?.id ||
    addon?.transportUrl ||
    'Unknown addon'
  );
}

function getAddonKey(addon: AddonLike | null | undefined): string {
  const id = addon?.manifest?.id;
  if (typeof id === 'string' && id.trim()) {
    return `id:${id.trim()}`;
  }

  const url = addon?.transportUrl;
  if (typeof url === 'string' && url.trim()) {
    return `url:${url.trim()}`;
  }

  const name = addon?.manifest?.name || addon?.name;
  if (typeof name === 'string' && name.trim()) {
    return `name:${name.trim()}`;
  }

  return 'unknown';
}

function toAddonArray(value: unknown): AddonLike[] {
  return Array.isArray(value) ? (value.filter(Boolean) as AddonLike[]) : [];
}

/**
 * Pure comparison of two addon collections.
 *
 * Addons are matched by `manifest.id`, falling back to `transportUrl` and then
 * to a display name. The result uses display names so it can be rendered
 * directly. `reordered` is true when the kept addons appear in a different
 * relative order between the two collections (independent of additions or
 * removals).
 */
export function diffAddonCollections(
  current: unknown,
  next: unknown
): AddonDiffResult {
  const currentList = toAddonArray(current);
  const nextList = toAddonArray(next);

  const currentByKey = new Map<string, AddonLike>();
  const currentOrder: string[] = [];
  for (const addon of currentList) {
    const key = getAddonKey(addon);
    if (!currentByKey.has(key)) {
      currentByKey.set(key, addon);
      currentOrder.push(key);
    }
  }

  const nextByKey = new Map<string, AddonLike>();
  const nextOrder: string[] = [];
  for (const addon of nextList) {
    const key = getAddonKey(addon);
    if (!nextByKey.has(key)) {
      nextByKey.set(key, addon);
      nextOrder.push(key);
    }
  }

  const added: string[] = [];
  for (const key of nextOrder) {
    if (!currentByKey.has(key)) {
      added.push(getAddonDisplayName(nextByKey.get(key)));
    }
  }

  const removed: string[] = [];
  for (const key of currentOrder) {
    if (!nextByKey.has(key)) {
      removed.push(getAddonDisplayName(currentByKey.get(key)));
    }
  }

  const keptKeysInNextOrder = nextOrder.filter((key) => currentByKey.has(key));
  const kept = keptKeysInNextOrder.map((key) =>
    getAddonDisplayName(nextByKey.get(key))
  );

  const keptKeysInCurrentOrder = currentOrder.filter((key) =>
    nextByKey.has(key)
  );

  const reordered = keptKeysInCurrentOrder.some(
    (key, idx) => key !== keptKeysInNextOrder[idx]
  );

  return { added, removed, kept, reordered };
}
