/**
 * Simple linear regression over (timestamp, value) data points
 * @param {Array<{x: number, y: number}>} points - Array of {x: timestamp_ms, y: value}
 * @returns {{slope: number, intercept: number, predict: (t: number) => number}}
 */
export function linearRegression(points) {
  if (!points || points.length === 0) {
    return { slope: 0, intercept: 0, predict: () => 0 }
  }

  if (points.length === 1) {
    return {
      slope: 0,
      intercept: points[0].y,
      predict: () => points[0].y
    }
  }

  const n = points.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0

  for (const point of points) {
    sumX += point.x
    sumY += point.y
    sumXY += point.x * point.y
    sumXX += point.x * point.x
  }

  // Calculate slope: (n*Σxy - Σx*Σy) / (n*Σx² - (Σx)²)
  const numerator = n * sumXY - sumX * sumY
  const denominator = n * sumXX - sumX * sumX

  const slope = denominator !== 0 ? numerator / denominator : 0
  const intercept = (sumY - slope * sumX) / n

  return {
    slope,
    intercept,
    predict: (t) => slope * t + intercept
  }
}
