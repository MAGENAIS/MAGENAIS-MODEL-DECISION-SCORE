# Contributing to DecisionScore

Thanks for your interest in contributing.

## Getting started

This package has **zero runtime dependencies** and needs no install step
to develop:

```bash
git clone https://github.com/MAGENAIS/MAGENAIS-MODEL-DECISION-SCORE.git
cd MAGENAIS-MODEL-DECISION-SCORE
npm test          # node --experimental-strip-types --test tests/*.test.ts
npm run example   # runs examples/basic-usage.mjs
```

Requires Node.js >= 22 (for `--experimental-strip-types`).

## Project layout

```
src/
  contract.ts               Model/ModelManifest/ModelRequest/ModelResponse shapes
  types.ts                  DecisionScore-specific input/output types
  DecisionScoreAlgorithm.ts Pure ranking algorithm (validation, normalization, weighted sum)
  DecisionStability.ts      DSI (stability) and DFP (flip point) metrics
  DecisionScoreModel.ts     Wraps the algorithm behind the Model interface
  index.ts                  Public exports
tests/                      node:test unit tests
examples/                   Runnable usage examples
docs/                       Algorithm background and research notes
```

## Ground rules

- **No runtime dependencies.** This package intentionally stays
  dependency-free. If a contribution needs one, open an issue to discuss
  first.
- **Determinism matters.** Anything involving randomness (currently only
  DSI's perturbation sampling) must go through the seeded PRNG in
  `DecisionStability.ts`, never `Math.random()` directly, so results stay
  reproducible for a given input + seed.
- **No TypeScript constructor parameter properties**
  (`constructor(private readonly x: T)`). The test runner uses Node's
  `--experimental-strip-types`, which does not support that syntax. Use a
  plain field declaration + assignment in the constructor body instead.
- **Keep `src/contract.ts` in sync** with the shared schema published in
  the `MAGENAIS-MODELS` catalog repository
  (`schemas/model-manifest.schema.json`, `schemas/model-response.schema.json`).
  If you need to change the contract shape, propose it there first.
- **Every algorithm change needs a test.** In particular, changes to
  scoring, DSI, or DFP should include a test with a known/expected result,
  not just "it doesn't throw."
- **No novelty overclaiming.** Please don't describe DSI/DFP as "the
  first" or "unprecedented" in docs or commit messages — see the
  "Research direction" section of `README.md`.

## Reporting bugs / requesting features

Open a GitHub issue with:

- the input that produced the unexpected result (or the feature request),
- what you expected vs. what happened,
- the package version.

## Pull requests

1. Fork and branch from `main`.
2. Add/update tests for your change.
3. Run `npm test` — it must pass with zero failures.
4. Update `CHANGELOG.md` under an "Unreleased" heading.
5. Open a PR describing the change and why it's needed.

## Code of Conduct

Be respectful and constructive. Disagreements about approach are fine and
expected in a research-oriented project; personal attacks are not.
