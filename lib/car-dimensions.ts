// Key dimensions in metres, car-local frame: floor underside at y = 0,
// centreline at x = 0, nose pointing +z. Roughly a 2026-regulation car
// (3.4 m wheelbase, 1.9 m wide, 18" wheels).
export const CAR = {
  frontAxle: 1.6,
  rearAxle: -1.8,
  frontTrack: 0.8,
  rearTrack: 0.78,
  tyreRadius: 0.355,
  rimRadius: 0.23,
  frontTyreWidth: 0.3,
  rearTyreWidth: 0.37,
  noseTip: 2.75,
  frontWingZ: 2.72,
  rearWingZ: -2.05,
  frontWingSpan: 1.8,
  rearWingSpan: 1.0,
} as const
