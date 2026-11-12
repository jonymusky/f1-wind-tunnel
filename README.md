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
- **Straights**: power-limited, or traction-limited out of slow corners. On straights the rear flap opens (DRS), both wings open (2026 active aero), or nothing does.
- **Braking**: friction-ellipse limited, combined with cornering.
- **Air density** follows each circuit's altitude, which is why Mexico City needs maximum wing.

### How close is it?

One set of constants for every circuit, calibrated against the 2025 pole laps (`node scripts/validate-lap.mjs`). With the best wing angles the simulator finds for each track:

| Circuit | 2025 pole | Simulated | Error |
| --- | --- | --- | --- |
| Monza | 1:18.792 | 1:19.800 | +1.3% |
| Spa-Francorchamps | 1:40.562 | 1:42.739 | +2.2% |
| Silverstone | 1:24.892 | 1:25.696 | +0.9% |
| Suzuka | 1:26.983 | 1:26.348 | −0.7% |
| Hungaroring | 1:15.372 | 1:16.241 | +1.2% |
| Red Bull Ring | 1:03.971 | 1:05.406 | +2.2% |
| Bahrain | 1:29.841 | 1:25.739 | −4.6% |
| Interlagos | 1:09.511 | 1:08.054 | −2.1% |
| Montréal | 1:10.899 | 1:11.373 | +0.7% |
| Austin | 1:32.510 | 1:30.436 | −2.2% |
| Mexico City | 1:15.586 | 1:14.529 | −1.4% |
| Shanghai | 1:30.641 | 1:29.295 | −1.5% |

RMS error 2.0%. Peak figures land in the reported ranges: about 6 g under braking, 4.5–6.6 g lateral, 330–350 km/h at the end of the straights.

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

Racing lines are derived from the [TUM FTM racetrack database](https://github.com/TUMFTM/racetrack-database) (LGPL-3.0); see `lib/tracks/data/NOTICE.md`. Not affiliated with Formula 1 or any team.
