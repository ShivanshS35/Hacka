import { EntityEdge, EntityNode } from '../types';

export interface GraphSubset {
  nodes: EntityNode[];
  edges: EntityEdge[];
  positions: Record<string, { x: number; y: number }>;
  /** Totals in the full graph, so the UI can say "showing 20 of 140". */
  totalNodes: number;
  totalEdges: number;
}

const W = 560;
const H = 420;
const CX = W / 2;
const CY = H / 2;

function hashAngle(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 360) * (Math.PI / 180);
}

function meanAngle(angles: number[]): number {
  const x = angles.reduce((s, a) => s + Math.cos(a), 0);
  const y = angles.reduce((s, a) => s + Math.sin(a), 0);
  return Math.atan2(y, x);
}

/**
 * Pick the part of the graph worth showing in the small Command Center panel and lay it out.
 * Identifiers that connect several posts (and any marked as shared across channels) go on an inner ring;
 * the posts that use them sit on an outer ring at the average angle of their identifiers.
 * Layout is deterministic: the same graph always draws the same way.
 */
export function selectAndLayout(
  nodes: EntityNode[],
  edges: EntityEdge[],
  maxEntities = 8,
  maxPosts = 18
): GraphSubset {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const incident = new Map<string, EntityEdge[]>();
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    (incident.get(e.source) ?? incident.set(e.source, []).get(e.source)!).push(e);
    (incident.get(e.target) ?? incident.set(e.target, []).get(e.target)!).push(e);
  }
  const degree = (id: string) => incident.get(id)?.length ?? 0;

  // 1. Identifiers: prefer the ones that link several posts.
  const identifiers = nodes.filter((n) => n.type !== 'post');
  const linking = identifiers.filter((n) => n.isHero || degree(n.id) >= 2);
  const pool = linking.length > 0 ? linking : identifiers;
  const chosenIds = [...pool]
    .sort(
      (a, b) =>
        Number(Boolean(b.isHero)) - Number(Boolean(a.isHero)) ||
        (b.channels?.length ?? 0) - (a.channels?.length ?? 0) ||
        degree(b.id) - degree(a.id) ||
        a.id.localeCompare(b.id)
    )
    .slice(0, maxEntities);
  const chosen = new Set(chosenIds.map((n) => n.id));

  // 2. Posts attached to those identifiers (most-connected first), then posts joined to them by a similar image.
  const postScore = new Map<string, number>();
  for (const id of chosen) {
    for (const e of incident.get(id) ?? []) {
      const other = e.source === id ? e.target : e.source;
      if (byId.get(other)?.type === 'post') postScore.set(other, (postScore.get(other) ?? 0) + 1);
    }
  }
  let postIds = [...postScore.keys()];
  for (const e of edges) {
    const a = byId.get(e.source);
    const b = byId.get(e.target);
    if (a?.type === 'post' && b?.type === 'post' && (postScore.has(a.id) || postScore.has(b.id))) {
      if (!postIds.includes(a.id)) postIds.push(a.id);
      if (!postIds.includes(b.id)) postIds.push(b.id);
    }
  }
  if (postIds.length === 0 && chosen.size === 0) {
    postIds = nodes.filter((n) => n.type === 'post').map((n) => n.id);
  }
  postIds = postIds
    .sort((a, b) => (postScore.get(b) ?? 0) - (postScore.get(a) ?? 0) || a.localeCompare(b))
    .slice(0, maxPosts);
  const posts = new Set(postIds);

  const visible = new Set<string>([...chosen, ...posts]);
  const subsetNodes = nodes.filter((n) => visible.has(n.id));
  const subsetEdges = edges.filter((e) => visible.has(e.source) && visible.has(e.target));

  // 3. Layout.
  const positions: Record<string, { x: number; y: number }> = {};
  const angleOf = new Map<string, number>();
  const n = chosenIds.length;
  const innerR = n <= 1 ? 0 : n <= 4 ? 80 : 100;
  chosenIds.forEach((node, i) => {
    const a = n <= 1 ? 0 : -Math.PI / 2 + (2 * Math.PI * i) / n;
    angleOf.set(node.id, a);
    positions[node.id] = { x: CX + innerR * Math.cos(a), y: CY + innerR * 0.8 * Math.sin(a) };
  });

  const outerR = 175;
  const placed = postIds.map((id, i) => {
    const entityAngles = (incident.get(id) ?? [])
      .map((e) => (e.source === id ? e.target : e.source))
      .filter((o) => angleOf.has(o))
      .map((o) => angleOf.get(o)!);
    const base = entityAngles.length ? (n <= 1 ? hashAngle(id) : meanAngle(entityAngles)) : hashAngle(id) + i;
    return { id, angle: base };
  });
  // Spread posts that landed at nearly the same angle so they do not overlap.
  placed.sort((a, b) => a.angle - b.angle);
  const minGap = (2 * Math.PI) / Math.max(placed.length, 10);
  for (let pass = 0; pass < 40; pass++) {
    for (let i = 1; i < placed.length; i++) {
      const gap = placed[i].angle - placed[i - 1].angle;
      if (gap < minGap) {
        const push = (minGap - gap) / 2;
        placed[i - 1].angle -= push;
        placed[i].angle += push;
      }
    }
  }
  for (const p of placed) {
    positions[p.id] = {
      x: Math.min(W - 40, Math.max(40, CX + outerR * 1.35 * Math.cos(p.angle))),
      y: Math.min(H - 35, Math.max(35, CY + outerR * 0.95 * Math.sin(p.angle))),
    };
  }

  return { nodes: subsetNodes, edges: subsetEdges, positions, totalNodes: nodes.length, totalEdges: edges.length };
}
