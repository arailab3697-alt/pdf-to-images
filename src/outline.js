const POINT_PRECISION = 6;

function roundCoord(value) {
  return Number(value.toFixed(POINT_PRECISION));
}

function uniqueSorted(values) {
  return [...new Set(values.map(roundCoord))].sort((a, b) => a - b);
}

function rectContainsCell(rect, x1, x2, y1, y2) {
  return x1 >= rect.x && x2 <= rect.x + rect.width && y1 >= rect.y && y2 <= rect.y + rect.height;
}

function keyForCell(row, col) {
  return `${row}:${col}`;
}

function createSegment(x1, y1, x2, y2) {
  return {
    x1: roundCoord(x1),
    y1: roundCoord(y1),
    x2: roundCoord(x2),
    y2: roundCoord(y2)
  };
}

export function normalizeOutlineRects(rects) {
  return rects
    .map((rect) => ({
      x: roundCoord(Number(rect.x) || 0),
      y: roundCoord(Number(rect.y) || 0),
      width: roundCoord(Number(rect.width) || 0),
      height: roundCoord(Number(rect.height) || 0)
    }))
    .filter((rect) => rect.width > 0 && rect.height > 0);
}

export function computeUnionOutlineSegments(rects) {
  const normalizedRects = normalizeOutlineRects(rects);
  if (normalizedRects.length === 0) return [];

  const xs = uniqueSorted(normalizedRects.flatMap((rect) => [rect.x, rect.x + rect.width]));
  const ys = uniqueSorted(normalizedRects.flatMap((rect) => [rect.y, rect.y + rect.height]));
  const coveredCells = new Set();

  for (let row = 0; row < ys.length - 1; row++) {
    for (let col = 0; col < xs.length - 1; col++) {
      const x1 = xs[col];
      const x2 = xs[col + 1];
      const y1 = ys[row];
      const y2 = ys[row + 1];
      if (normalizedRects.some((rect) => rectContainsCell(rect, x1, x2, y1, y2))) {
        coveredCells.add(keyForCell(row, col));
      }
    }
  }

  const isCovered = (row, col) => coveredCells.has(keyForCell(row, col));
  const segments = [];

  for (let row = 0; row < ys.length - 1; row++) {
    for (let col = 0; col < xs.length - 1; col++) {
      if (!isCovered(row, col)) continue;

      const x1 = xs[col];
      const x2 = xs[col + 1];
      const y1 = ys[row];
      const y2 = ys[row + 1];

      if (!isCovered(row - 1, col)) segments.push(createSegment(x1, y1, x2, y1));
      if (!isCovered(row, col + 1)) segments.push(createSegment(x2, y1, x2, y2));
      if (!isCovered(row + 1, col)) segments.push(createSegment(x2, y2, x1, y2));
      if (!isCovered(row, col - 1)) segments.push(createSegment(x1, y2, x1, y1));
    }
  }

  return segments;
}

export function outlineSegmentsToSvgPath(segments) {
  return segments
    .map((segment) => `M ${segment.x1} ${segment.y1} L ${segment.x2} ${segment.y2}`)
    .join(' ');
}
