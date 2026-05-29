import { describe, expect, it } from 'vitest';
import { computeUnionOutlineSegments } from './outline.js';

function segmentKey(segment) {
  return `${segment.x1},${segment.y1}->${segment.x2},${segment.y2}`;
}

describe('computeUnionOutlineSegments', () => {
  it('outlines a single rectangle', () => {
    expect(computeUnionOutlineSegments([{ x: 0, y: 0, width: 10, height: 20 }]).map(segmentKey)).toEqual([
      '0,0->10,0',
      '10,0->10,20',
      '10,20->0,20',
      '0,20->0,0'
    ]);
  });

  it('removes internal edges from overlapping rectangles', () => {
    const segments = computeUnionOutlineSegments([
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 50, y: 0, width: 100, height: 100 }
    ]).map(segmentKey);

    expect(new Set(segments)).toEqual(new Set([
      '0,0->50,0',
      '0,100->0,0',
      '50,0->100,0',
      '100,0->150,0',
      '150,0->150,100',
      '50,100->0,100',
      '100,100->50,100',
      '150,100->100,100'
    ]));
    expect(segments).not.toContain('50,0->50,100');
    expect(segments).not.toContain('100,100->100,0');
  });

  it('keeps concave outer perimeter edges when rectangles partially overlap', () => {
    const segments = computeUnionOutlineSegments([
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 50, y: 50, width: 100, height: 100 }
    ]).map(segmentKey);

    expect(segments).toContain('100,0->100,50');
    expect(segments).toContain('100,50->150,50');
    expect(segments).toContain('50,150->50,100');
    expect(segments).toContain('100,150->50,150');
    expect(segments).not.toContain('50,50->100,50');
    expect(segments).not.toContain('50,100->50,50');
  });
});
