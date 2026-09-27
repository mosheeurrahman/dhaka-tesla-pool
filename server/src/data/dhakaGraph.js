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

// Dijkstra shortest path between two zone codes.
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

module.exports = { EDGES, adjacency, shortestPath, edgeKey, edgeWeight };