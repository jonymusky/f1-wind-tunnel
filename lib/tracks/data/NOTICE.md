# Track data

The JSON files in this folder are derived from the
[TUM FTM racetrack database](https://github.com/TUMFTM/racetrack-database)
(Technical University of Munich, Chair of Automotive Technology), commit
`e59595d1f3573b30d1ded6a08984935b957688e0`, which is licensed under the
GNU Lesser General Public License v3.0. That licence (`LICENSE.LGPL`) and the
GNU GPL v3 it builds on (`LICENSE.GPL`) are next to this file, and these derived
files are distributed under the same terms.

Changes made (November 2026): the minimum-curvature racing lines were resampled to a uniform
4 m step, signed curvature was computed and lightly smoothed, and coordinates
were rounded to 0.1 m. `scripts/build-tracks.mjs` reproduces them.

The original centre lines come from OpenStreetMap (© OpenStreetMap contributors)
and the track widths from satellite imagery, as described in the database README.
