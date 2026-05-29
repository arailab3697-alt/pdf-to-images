const POINT_PRECISION = 6;
const GEOMETRY_EPSILON = 1 / 10 ** POINT_PRECISION;

function roundCoord(value) {
  return Number(value.toFixed(POINT_PRECISION));
}

function uniqueSorted(values) {
  return [...new Set(values.map(roundCoord))].sort((a, b) => a - b);
}

function rectContainsCell(rect, x1, x2, y1, y2) {
  return (
    x1 >= rect.x - GEOMETRY_EPSILON &&
    x2 <= rect.x + rect.width + GEOMETRY_EPSILON &&
    y1 >= rect.y - GEOMETRY_EPSILON &&
    y2 <= rect.y + rect.height + GEOMETRY_EPSILON
  );
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

function normalizeInterval(start, end) {
  return start <= end ? { start, end } : { start: end, end: start };
}

function addInterval(groups, key, start, end) {
  const roundedKey = roundCoord(key);
  const interval = normalizeInterval(roundCoord(start), roundCoord(end));
  if (interval.end - interval.start <= GEOMETRY_EPSILON) return;

  if (!groups.has(roundedKey)) {
    groups.set(roundedKey, []);
  }
  groups.get(roundedKey).push(interval);
}

function mergeIntervals(intervals) {
  const sorted = [...intervals].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];

  sorted.forEach((interval) => {
    const previous = merged.at(-1);
    if (previous && interval.start <= previous.end + GEOMETRY_EPSILON) {
      previous.end = Math.max(previous.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  });

  return merged;
}

function mergeCollinearSegments(segments) {
  const horizontal = new Map();
  const vertical = new Map();

  segments.forEach((segment) => {
    if (segment.y1 === segment.y2) {
      addInterval(horizontal, segment.y1, segment.x1, segment.x2);
    } else if (segment.x1 === segment.x2) {
      addInterval(vertical, segment.x1, segment.y1, segment.y2);
    }
  });

  const mergedSegments = [];
  [...horizontal.entries()]
    .sort(([a], [b]) => a - b)
    .forEach(([y, intervals]) => {
      mergeIntervals(intervals).forEach((interval) => {
        mergedSegments.push(createSegment(interval.start, y, interval.end, y));
      });
    });

  [...vertical.entries()]
    .sort(([a], [b]) => a - b)
    .forEach(([x, intervals]) => {
      mergeIntervals(intervals).forEach((interval) => {
        mergedSegments.push(createSegment(x, interval.start, x, interval.end));
      });
    });

  return mergedSegments.sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1 || a.y2 - b.y2 || a.x2 - b.x2);
}

export function normalizeOutlineRects(rects) {
  return rects
    .map((rect) => {
      const x1 = roundCoord(Number(rect.x) || 0);
      const y1 = roundCoord(Number(rect.y) || 0);
      const x2 = roundCoord((Number(rect.x) || 0) + (Number(rect.width) || 0));
      const y2 = roundCoord((Number(rect.y) || 0) + (Number(rect.height) || 0));
      return {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: roundCoord(Math.abs(x2 - x1)),
        height: roundCoord(Math.abs(y2 - y1))
      };
    })
    .filter((rect) => rect.width > GEOMETRY_EPSILON && rect.height > GEOMETRY_EPSILON);
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

  return mergeCollinearSegments(segments);
}

export function outlineSegmentsToSvgPath(segments) {
  return segments
    .map((segment) => `M ${segment.x1} ${segment.y1} L ${segment.x2} ${segment.y2}`)
    .join(' ');
}
