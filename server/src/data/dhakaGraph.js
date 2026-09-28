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
// can be merged into `spine` (the vehicle's combined route) to form ONE
// longer simple path in the SAME direction of travel: no forking, no
// revisited nodes, no passenger travelling against the vehicle.
function tryMergePath(spine, candidate) {
  if (!spine || spine.length === 0) return candidate;

  if (findContiguousSublistIndex(spine, candidate) !== -1) return spine;
  if (findContiguousSublistIndex(candidate, spine) !== -1) return candidate;

  // spine's tail overlaps candidate's head - extend forward
  for (let overlap = Math.min(spine.length, candidate.length); overlap >= 1; overlap--) {
    if (arraysEqual(spine.slice(spine.length - overlap), candidate.slice(0, overlap))) {
      const merged = spine.concat(candidate.slice(overlap));
      if (!hasDuplicates(merged)) return merged;
    }
  }

  // candidate's tail overlaps spine's head - extend backward
  for (let overlap = Math.min(spine.length, candidate.length); overlap >= 1; overlap--) {
    if (arraysEqual(candidate.slice(candidate.length - overlap), spine.slice(0, overlap))) {
      const merged = candidate.slice(0, candidate.length - overlap).concat(spine);
      if (!hasDuplicates(merged)) return merged;
    }
  }

  return null;
}

module.exports = { EDGES, adjacency, shortestPath, edgeKey, edgeWeight, tryMergePath };