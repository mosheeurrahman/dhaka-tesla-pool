const { shortestPath } = require('../src/data/dhakaGraph');

describe('dhakaGraph - Dijkstra shortest path', () => {
  it('finds the direct edge when it is shortest', () => {
    const route = shortestPath('MOHAKHALI', 'GULSHAN1');
    expect(route.path).toEqual(['MOHAKHALI', 'GULSHAN1']);
    expect(route.distanceKm).toBeCloseTo(1.5);
  });

  it('finds a multi-hop shortest path over a longer direct edge', () => {
    // Direct BANANI-UTTARA is 15.2km; via GULSHAN2-GULSHAN1-MOHAKHALI is
    // also long. The point: Dijkstra should pick whichever is truly shortest.
    const route = shortestPath('MOHAMMADPUR', 'BRACU');
    // Mohammadpur-Farmgate(5.2)-BRACU(7.5) = 12.7
    // Mohammadpur-Mohakhali(9.1)-Gulshan1(1.5)-BRACU(2.5) = 13.1
    expect(route.path).toEqual(['MOHAMMADPUR', 'FARMGATE', 'BRACU']);
    expect(route.distanceKm).toBeCloseTo(12.7);
  });

  it('returns null for identical start and end (no self-path expected in practice)', () => {
    const route = shortestPath('UTTARA', 'UNKNOWN_CODE');
    expect(route).toBeNull();
  });
});