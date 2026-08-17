export type Breakdown = {
  distanceKm: number;
  paceMinPerKm: number;
  baseWalkingMinutes: number;
  elevationGainM: number;
  elevationPenaltyMinutes: number;
  stopMinutes: number;
  totalMinutes: number;
};

export function calculateEstimate(input: {
  distanceKm: number;
  elevationGainM: number;
  paceMinPerKm: number;
  stopMinutes: number;
}): Breakdown {
  const baseWalkingMinutes = input.distanceKm * input.paceMinPerKm;
  const elevationPenaltyMinutes = (input.elevationGainM / 100) * 10;
  const totalMinutes = baseWalkingMinutes + elevationPenaltyMinutes + input.stopMinutes;

  return {
    distanceKm: round(input.distanceKm, 3),
    paceMinPerKm: round(input.paceMinPerKm, 2),
    baseWalkingMinutes: round(baseWalkingMinutes, 1),
    elevationGainM: round(input.elevationGainM, 0),
    elevationPenaltyMinutes: round(elevationPenaltyMinutes, 1),
    stopMinutes: round(input.stopMinutes, 1),
    totalMinutes: round(totalMinutes, 1)
  };
}

function round(value: number, places: number) {
  const factor = Math.pow(10, places);
  return Math.round(value * factor) / factor;
}
