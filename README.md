# F1 Wind Tunnel — AeroSim

Put a Formula 1 car in a wind tunnel, then take the same setup out on track.

**→ [f1-aero-sim.jonymusky.com](https://f1-aero-sim.jonymusky.com)**

## Tunnel

Change wing angles, ride height, rake and yaw and watch streamlines, smoke, surface pressure and the forces respond. The aero model (`lib/aero.ts`) is a set of smooth fits tuned to publicly reported ranges, not CFD.

## Track

The **Track** tab drives the same car around twelve Grand Prix circuits with a quasi-steady-state lap simulator (`lib/lap/sim.ts`). Every change to the setup or the car (power, mass, fuel, tyre compound, DRS or active aero) re-runs the lap in a few milliseconds and shows:

- lap and sector times, and the difference against the baseline setup;
- the racing line coloured by speed or by what limits the car at each point (power, traction, braking, front or rear grip);
- a car lapping in real time with speed, throttle, brake, g and running ride height;
- the speed trace over the lap, with the baseline dashed behind it.

### How the lap is computed

The car is a point mass on two axles following a minimum-curvature racing line.

- **Cornering**: each axle has load-sensitive tyres; the car corners as fast as the first axle to saturate allows, so an aero balance that does not match the weight distribution costs lap time as understeer or oversteer.
- **Aero**: coefficients come from the tunnel model. The floor sits on springs, so aero load squashes the ride height as speed builds; set the car too low and the floor stalls in fast corners.
- **Straights**: power-limited, or traction-limited out of slow corners. On straights of 400 m or more the rear flap opens (DRS), on shorter ones too both wings open (2026 active aero), or nothing does. With DRS the simulator wants a small wing at Monza and a big one at the Hungaroring; with active aero the drag is shed anyway, so more wing pays off everywhere.
- **Braking**: friction-ellipse limited, combined with cornering.
- **Air density** follows each circuit's altitude, which is why Mexico City needs maximum wing.

### How close is it?

One set of constants for every circuit, calibrated against the 2025 pole laps (`node scripts/validate-lap.mjs`). With the best wing angles the simulator finds for each track:

| Circuit | 2025 pole | Simulated | Error |
| --- | --- | --- | --- |
| Monza | 1:18.792 | 1:20.278 | +1.9% |
| Spa-Francorchamps | 1:40.562 | 1:43.119 | +2.5% |
| Silverstone | 1:24.892 | 1:26.242 | +1.6% |
| Suzuka | 1:26.983 | 1:26.690 | −0.3% |
| Hungaroring | 1:15.372 | 1:16.573 | +1.6% |
| Red Bull Ring | 1:03.971 | 1:05.816 | +2.9% |
| Bahrain | 1:29.841 | 1:26.242 | −4.0% |
| Interlagos | 1:09.511 | 1:08.181 | −1.9% |
| Montréal | 1:10.899 | 1:11.895 | +1.4% |
| Austin | 1:32.510 | 1:30.820 | −1.8% |
| Mexico City | 1:15.586 | 1:14.885 | −0.9% |
| Shanghai | 1:30.641 | 1:29.821 | −0.9% |

RMS error 2.0%. Peak loads sit inside the commonly quoted ranges (4–6.5 g lateral, 5–6 g under braking): the simulator peaks at about 6 g braking and 4–6.4 g lateral. It reaches 325–350 km/h at the end of the straights; that figure was not checked against speed-trap data. Bahrain is the outlier: the model has no notion of a low-grip surface.

The splits shown in the app are equal thirds of the lap, not the official timing sectors, and the lap starts where the source data starts, which is close to but not surveyed as the timing line.

**Not modelled:** elevation and banking, kerbs and bumps, track surface grip, tyre temperature and wear, transient weight transfer, gear ratios and hybrid energy deployment (power is constant). Trust the differences between setups more than the absolute lap time.

## Develop

```bash
npm install
npm run dev                      # http://localhost:3000
npm run typecheck
npm run build                    # static export to out/
node scripts/build-tracks.mjs    # regenerate lib/tracks/data from the source database
node scripts/validate-lap.mjs    # lap times against the 2025 poles
```

Pushing to `main` deploys to GitHub Pages.

## Credits

Racing lines are derived from the [TUM FTM racetrack database](https://github.com/TUMFTM/racetrack-database) (LGPL-3.0); see `lib/tracks/data/NOTICE.md`. Circuit altitudes are from [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (MIT). Pole laps are the 2025 qualifying results. Not affiliated with Formula 1 or any team.
