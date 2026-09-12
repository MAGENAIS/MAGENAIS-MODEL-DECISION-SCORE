# DecisionScore

Explainable multi-criteria decision intelligence. Part of the
[MAGENAIS Model Hub](https://github.com/MAGENAIS/MAGENAIS-MODELS),
but fully independent — you can use this package without installing or
running MAGENAIS at all.

> **Research-oriented.** DecisionScore is a MAGENAIS research model. Its
> metrics (DSI, DFP) are original names for well-understood ideas in
> multi-criteria decision analysis (weighted-sum scoring and sensitivity
> analysis); no novelty claim is made beyond that framing. See
> [Research direction](#research-direction).

## What it does

Given a set of **options** scored against a set of weighted **criteria**,
DecisionScore:

1. Normalizes each criterion's scores to a common [0, 1] scale (accounting
   for whether higher-is-better or lower-is-better).
2. Computes a weighted sum per option and ranks them.
3. Estimates **Decision Stability Index (DSI)** — the proportion of
   randomized weight perturbations under which the top choice stays the
   same.
4. Estimates **Decision Flip Point (DFP)** — how much a given criterion's
   weight would need to change, and in which direction, before a
   different option takes first place.

Both DSI and DFP are **sensitivity estimates under tested assumptions —
not guarantees.** DecisionScore does not claim to predict the "correct"
decision; it quantifies how confidently the data supports the one it
computed.

## Input

```ts
interface DecisionScoreInput {
  options: { id: string; name?: string }[];
  criteria: {
    id: string;
    name?: string;
    weight: number; // relative importance; need not sum to 1
    direction: 'maximize' | 'minimize';
  }[];
  scores: Record<string /* optionId */, Record<string /* criterionId */, number>>;
  constraints?: string[]; // free-form notes, not evaluated numerically in v1.0.0
}
```

## Output

```ts
interface DecisionScoreOutput {
  ranking: { optionId: string; name?: string; score: number; rank: number }[];
  topOptionId: string | null;
  dsi: number; // Decision Stability Index, 0–1
  dfp: {
    criterionId: string;
    criterionName?: string;
    direction: 'increase' | 'decrease';
    relativeChange: number | null; // e.g. 0.15 = 15%; null if no flip found in range
    challengerOptionId: string | null;
  }[];
}
```

## Algorithm

- **Ranking:** normalized weighted-sum (a.k.a. Simple Additive Weighting /
  SAW). Each criterion's column is min-max normalized across the given
  options (inverted for `minimize` criteria), then combined using each
  criterion's normalized weight.
- **DSI:** repeatedly perturbs each criterion's weight by a random factor
  (seeded, so results are reproducible) within a configurable magnitude,
  recomputes the ranking, and reports the fraction of trials where the top
  option didn't change.
- **DFP:** for each criterion, sweeps its weight up and down (renormalizing
  the rest proportionally) in small steps until the top option changes,
  and reports the smallest relative change that did so.

## Example

```ts
import { DecisionScoreModel } from '@magenais/decision-score';

const model = new DecisionScoreModel();

const response = await model.execute({
  input: {
    options: [
      { id: 'vendor-a', name: 'Vendor A' },
      { id: 'vendor-b', name: 'Vendor B' },
    ],
    criteria: [
      { id: 'price', weight: 2, direction: 'minimize' },
      { id: 'quality', weight: 3, direction: 'maximize' },
    ],
    scores: {
      'vendor-a': { price: 8000, quality: 7 },
      'vendor-b': { price: 9500, quality: 9 },
    },
  },
});

console.log(response.output.ranking);
console.log(response.explanation);
```

See `examples/basic-usage.mjs` for a runnable version of this.

## Limitations

- Weighted-sum scoring assumes criteria are at least roughly
  commensurable once normalized; it does not model strong non-linear
  trade-offs between criteria.
- `constraints` is currently a documentation-only field — it is not
  enforced numerically in v1.0.0.
- DSI/DFP are estimates over a *tested* perturbation range, not an
  exhaustive or formally-proven sensitivity bound.

## Research direction

DSI and DFP are designed to be subjected to literature review,
benchmarking against established multi-criteria decision analysis (MCDA)
sensitivity techniques, ablation studies, and statistical validation.
Contributions in that direction are welcome — see `CONTRIBUTING.md`.

## Version

`1.0.0` — versioned independently of MAGENAIS itself.

## License

Apache-2.0. See `LICENSE`.
