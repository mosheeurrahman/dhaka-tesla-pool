const EDGES = [
  ['UTTARA', 'MIRPUR10', 10.1],
  ['MIRPUR10', 'MOHAMMADPUR', 7.5],
  ['MOHAMMADPUR', 'FARMGATE', 5.2],
  ['MOHAMMADPUR', 'DHAHANMANDI', 3.3],
  ['MOHAMMADPUR', 'MOHAKHALI', 9.1],
  ['DHAHANMANDI', 'FARMGATE', 3.6],
  ['FARMGATE', 'MOHAKHALI', 6.1],
  ['FARMGATE', 'BRACU', 7.5],
  ['BRACU', 'GULSHAN1', 2.5],
  ['MOHAKHALI', 'GULSHAN1', 1.5],
  ['GULSHAN1', 'GULSHAN2', 1.7],
  ['GULSHAN2', 'BANANI', 1.1],
  ['BANANI', 'UTTARA', 15.2],
  ['BANANI', 'MOHAKHALI', 3.4],
  ['MIRPUR10', 'MOHAKHALI', 11.2],
];

const adjacency = {};
for (const [u, v, w] of EDGES) {
  adjacency[u] = adjacency[u] || [];
  adjacency[v] = adjacency[v] || [];
  adjacency[u].push({ node: v, weight: w });
  adjacency[v].push({ node: u, weight: w });
}

function edgeKey(a, b) {
  return [a, b].sort().join('__');
}

function edgeWeight(a, b) {
  const found = (adjacency[a] || []).find((n) => n.node === b);
  return found ? found.weight : 0;
}

function shortestPath(startCode, endCode) {
  const dist = {};
  const prev = {};
  const visited = new Set();
  const queue = new Set(Object.keys(adjacency));

  for (const node of queue) dist[node] = Infinity;
  dist[startCode] = 0;

  while (queue.size) {
    let current = null;
    let currentDist = Infinity;
    for (const node of queue) {
      if (dist[node] < currentDist) {
        currentDist = dist[node];
        current = node;
      }
    }
    if (current === null) break;
    queue.delete(current);
    visited.add(current);
    if (current === endCode) break;

    for (const neighbor of adjacency[current] || []) {
      if (visited.has(neighbor.node)) continue;
      const alt = dist[current] + neighbor.weight;
      if (alt < dist[neighbor.node]) {
        dist[neighbor.node] = alt;
        prev[neighbor.node] = current;
      }
    }
  }

  if (!Number.isFinite(dist[endCode])) return null;

  const path = [];
  let node = endCode;
  while (node !== undefined) {
    path.unshift(node);
    node = prev[node];
  }

  const edges = [];
  for (let i = 0; i < path.length - 1; i++) {
    edges.push({ from: path[i], to: path[i + 1] });
  }

  return { path, distanceKm: dist[endCode], edges };
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function hasDuplicates(arr) {
  return new Set(arr).size !== arr.length;
}

function findContiguousSublistIndex(haystack, needle) {
  if (needle.length === 0 || needle.length > haystack.length) return -1;
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) { match = false; break; }
    }
    if (match) return i;
  }
  return -1;
}

// Determines whether `candidate` (a passenger's pickup->destination path)
// can be merged into `spine` (the vehicle's current combined route) to
// form ONE longer simple path with no revisited nodes - i.e. a single
// straight line the vehicle can actually drive without doubling back or
// forking. Returns the merged path (array of zone codes) if compatible,
// or null if the routes fork and cannot share one vehicle.
function tryMergePath(spine, candidate) {
  if (!spine || spine.length === 0) return candidate;

  const orientations = [candidate, [...candidate].reverse()];

  for (const c of orientations) {
    // candidate already lies entirely within the existing spine
    if (findContiguousSublistIndex(spine, c) !== -1) return spine;
    // the existing spine lies entirely within the candidate (candidate supersedes it)
    if (findContiguousSublistIndex(c, spine) !== -1) return c;

    // spine's tail overlaps candidate's head - extend forward
    for (let overlap = Math.min(spine.length, c.length); overlap >= 1; overlap--) {
      const spineSuffix = spine.slice(spine.length - overlap);
      const cPrefix = c.slice(0, overlap);
      if (arraysEqual(spineSuffix, cPrefix)) {
        const merged = spine.concat(c.slice(overlap));
        if (!hasDuplicates(merged)) return merged;
      }
    }

    // candidate's tail overlaps spine's head - extend backward
    for (let overlap = Math.min(spine.length, c.length); overlap >= 1; overlap--) {
      const cSuffix = c.slice(c.length - overlap);
      const spinePrefix = spine.slice(0, overlap);
      if (arraysEqual(cSuffix, spinePrefix)) {
        const merged = c.slice(0, c.length - overlap).concat(spine);
        if (!hasDuplicates(merged)) return merged;
      }
    }
  }

  return null;
}

module.exports = { EDGES, adjacency, shortestPath, edgeKey, edgeWeight, tryMergePath };