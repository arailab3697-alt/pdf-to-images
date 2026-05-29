import { describe, expect, it } from 'vitest';
import { computeUnionOutlineSegments } from './outline.js';

function segmentKey(segment) {
  return `${segment.x1},${segment.y1}->${segment.x2},${segment.y2}`;
}

function expectSegments(rects, expected) {
  expect(new Set(computeUnionOutlineSegments(rects).map(segmentKey))).toEqual(new Set(expected));
}

describe('computeUnionOutlineSegments', () => {
  it('outlines a single rectangle', () => {
    expectSegments([{ x: 0, y: 0, width: 10, height: 20 }], [
      '0,0->10,0',
      '0,20->10,20',
      '0,0->0,20',
      '10,0->10,20'
    ]);
  });

  it('removes internal edges from overlapping rectangles and merges straight perimeter runs', () => {
    const segments = computeUnionOutlineSegments([
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 50, y: 0, width: 100, height: 100 }
    ]).map(segmentKey);

    expect(new Set(segments)).toEqual(new Set([
      '0,0->150,0',
      '0,100->150,100',
      '0,0->0,100',
      '150,0->150,100'
    ]));
    expect(segments).not.toContain('50,0->50,100');
    expect(segments).not.toContain('100,100->100,0');
  });

  it('keeps concave outer perimeter edges when rectangles partially overlap', () => {
    const segments = computeUnionOutlineSegments([
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 50, y: 50, width: 100, height: 100 }
    ]).map(segmentKey);

    expect(new Set(segments)).toEqual(new Set([
      '0,0->100,0',
      '100,50->150,50',
      '0,100->50,100',
      '50,150->150,150',
      '0,0->0,100',
      '50,100->50,150',
      '100,0->100,50',
      '150,50->150,150'
    ]));
    expect(segments).not.toContain('50,50->100,50');
    expect(segments).not.toContain('50,100->50,50');
  });

  it('does not emit contained-image edges', () => {
    expectSegments([
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 25, y: 25, width: 50, height: 50 }
    ], [
      '0,0->100,0',
      '0,100->100,100',
      '0,0->0,100',
      '100,0->100,100'
    ]);
  });

  it('is tolerant of tiny floating point differences at shared edges', () => {
    expectSegments([
      { x: 0.1, y: 0.1, width: 99.9, height: 99.9 },
      { x: 100, y: 0.1, width: 50.0000001, height: 99.9 }
    ], [
      '0.1,0.1->150,0.1',
      '0.1,100->150,100',
      '0.1,0.1->0.1,100',
      '150,0.1->150,100'
    ]);
  });
});
