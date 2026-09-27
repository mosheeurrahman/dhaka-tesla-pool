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
describe('dhakaGraph - tryMergePath (single-line matching)', () => {
  it('merges two paths that connect end-to-end through a shared node', () => {
    // Mohammadpur->Mohakhali (direct, 9.1km) then Mohakhali->Gulshan1 (direct, 1.5km)
    const spine = shortestPath('MOHAMMADPUR', 'MOHAKHALI').path;
    const candidate = shortestPath('MOHAKHALI', 'GULSHAN1').path;
    const merged = require('../src/data/dhakaGraph').tryMergePath(spine, candidate);
    expect(merged).toEqual(['MOHAMMADPUR', 'MOHAKHALI', 'GULSHAN1']);
  });

  it('rejects two paths that fork at a shared destination from different directions', () => {
    // Mohammadpur->BRACU and Dhanmondi->BRACU both end at BRACU via Farmgate,
    // but arrive from different directions - no single line serves both.
    const spine = shortestPath('MOHAMMADPUR', 'BRACU').path;
    const candidate = shortestPath('DHAHANMANDI', 'BRACU').path;
    const merged = require('../src/data/dhakaGraph').tryMergePath(spine, candidate);
    expect(merged).toBeNull();
  });

  it('accepts a candidate path fully contained within the existing spine', () => {
    const spine = shortestPath('MOHAMMADPUR', 'GULSHAN1').path; // longer combined route
    const candidate = shortestPath('MOHAKHALI', 'GULSHAN1').path; // subset of it
    const merged = require('../src/data/dhakaGraph').tryMergePath(spine, candidate);
    expect(merged).toEqual(spine);
  });
});