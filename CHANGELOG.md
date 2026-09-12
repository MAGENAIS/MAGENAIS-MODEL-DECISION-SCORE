# Changelog

All notable changes to this project will be documented in this file.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/), and
this project uses [Semantic Versioning](https://semver.org/), independent
of MAGENAIS's own version.

## [Unreleased]

Nothing yet.

## [1.0.0] — not yet released

Prepared during MAGENAIS V4.1 Phase 3. Not yet published — see
`../DECISIONSCORE-REPO-READY.md` in the MAGENAIS repository for the
publish checklist and remaining GitHub-repository checkpoint.

### Added

- `DecisionScoreModel` implementing the shared `Model` contract
  (`execute()` → normalized `ModelResponse`).
- Normalized weighted-sum ranking algorithm (`DecisionScoreAlgorithm.ts`)
  with full input validation.
- Decision Stability Index (DSI): seeded, reproducible perturbation testing
  of criterion weights.
- Decision Flip Point (DFP): deterministic sweep per criterion to find the
  smallest weight change that flips the top-ranked option.
- Unit tests covering: a 3-option/4-criterion known-ranking case, DSI,
  DFP, empty input, invalid input, missing values, single-row data, a
  small dataset, and a larger (25-option) synthetic dataset.
- Runnable example (`examples/basic-usage.mjs`).
- `model.json` manifest, Apache-2.0 `LICENSE`, `SECURITY.md`,
  `CONTRIBUTING.md`.
