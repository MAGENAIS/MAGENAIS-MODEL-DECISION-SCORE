# Algorithm

## 1. Ranking (normalized weighted sum)

Given options `O = {o_1, ..., o_n}` and criteria `C = {c_1, ..., c_m}` each
with a raw weight `w_j >= 0` and a direction (`maximize` or `minimize`):

1. **Normalize weights.** `W_j = w_j / Σw_j`, so weights sum to 1.
2. **Normalize scores per criterion (min-max).** For criterion `c_j`, let
   `min_j` and `max_j` be the minimum/maximum raw score across all options.
   For option `o_i`:
   - if `max_j == min_j` (every option has the same score on this
     criterion), the criterion is **non-discriminating**: every option
     gets a normalized value of `1` for it, and it is reported separately
     in the response (it contributes its full weight equally to every
     option, so it does not change the ranking, but this is surfaced
     rather than hidden).
   - otherwise: `scaled = (raw - min_j) / (max_j - min_j)`, then
     `normalized = scaled` if `maximize`, or `normalized = 1 - scaled` if
     `minimize`. Either way, `1` always means "best on this criterion."
3. **Weighted sum.** `score(o_i) = Σ_j W_j * normalized(o_i, c_j)`, which
   lands in `[0, 1]`.
4. **Rank** options by descending `score`. Ties keep input order (stable
   sort); exact ties are visible via equal `score` values rather than
   collapsed into a single rank.

This is the classic **Simple Additive Weighting (SAW)** method from
multi-criteria decision analysis (MCDA) — DecisionScore does not claim to
have invented weighted-sum scoring; its contribution is packaging it with
the two sensitivity metrics below in an explainable, model-contract shape.

## 2. Decision Stability Index (DSI)

**Question it answers:** "If my weight estimates are somewhat off, would I
still pick the same option?"

**Method:**

1. Run `trials` times (default 200).
2. On each trial, multiply every criterion's raw weight by an independent
   random factor drawn uniformly from `[1 - magnitude, 1 + magnitude]`
   (default `magnitude = 0.2`, i.e. ±20%), using a seeded PRNG
   ([mulberry32](https://github.com/bryc/code/blob/master/jshash/PRNGs.md))
   so the same `(input, seed)` always reproduces the same trials.
3. Re-run the full ranking procedure (§1) on the perturbed weights.
4. `DSI = (number of trials where the top option is unchanged) / trials`.

A single option is a degenerate case: it is trivially always "the top
option," so `DSI = 1` without running any trials.

**Interpretation:** `DSI = 0.92` means the top choice was unchanged in 92%
of the tested perturbations — a rough gauge of how much of the decision's
"confidence" comes from the specific weight values you supplied, versus
being robust across a plausible range around them.

## 3. Decision Flip Point (DFP)

**Question it answers:** "How much would criterion X's importance need to
change, and in which direction, before a different option becomes the top
choice — and to which option?"

**Method:** for each criterion, independently:

1. Starting from the baseline (unperturbed) weights, sweep a relative
   change `δ` from `step` up to `maxRange` (defaults: `step = 0.05`,
   `maxRange = 5`, i.e. up to a 500% change) in both the `increase` and
   `decrease` direction.
2. At each `δ`, scale that criterion's raw weight by `(1 + δ)` (clamped at
   0 for decreases), **renormalize all weights** (§1 step 1) so they still
   sum to 1 — this is what makes the change meaningful: increasing one
   criterion's share necessarily decreases the others' relative share —
   and recompute the ranking.
3. The first `δ` (smallest magnitude) at which the top option changes is
   the flip point for that direction. If no `δ` up to `maxRange` produces
   a flip, `relativeChange` is reported as `null` for that direction.
4. Per criterion, the smaller (more sensitive) of the increase/decrease
   flip points is kept; if neither direction found a flip within range,
   `relativeChange: null` is reported for that criterion.
5. Criteria are sorted most-sensitive-first (smallest non-null
   `relativeChange` first; `null` entries last).

A single option is degenerate: there is no other option to flip to, so
every criterion reports `relativeChange: null`.

**Interpretation:** a DFP entry like `{ criterionId: "quality", direction:
"decrease", relativeChange: 0.15, challengerOptionId: "vendor-c" }` means:
if "quality"'s weight were reduced by roughly 15% (with the rest
renormalized accordingly), "vendor-c" would overtake the current top
choice.

## What this is not

- Not a causal model. Sensitivity here is purely about the arithmetic of
  the weighted sum, not about any real-world mechanism.
- Not exhaustive. Both metrics test a *bounded, tested* range of
  perturbations — a flip point beyond `maxRange`, or a form of uncertainty
  not captured by proportional weight scaling (e.g. correlated errors in
  the raw *scores* rather than the weights), is out of scope for v1.0.0.
- Not a substitute for domain judgment about whether the criteria,
  weights, and raw scores themselves are the right ones to begin with.

## Research direction

Candidate directions for follow-up validation (see `CONTRIBUTING.md`):

- Compare DSI/DFP's perturbation-based sensitivity against established
  MCDA sensitivity-analysis techniques (e.g. one-at-a-time weight sweeps
  as commonly used with SAW/WSM, or gradient-based sensitivity for
  differentiable scoring rules).
- Ablation on perturbation distribution choice (uniform vs. normal) and
  its effect on DSI's reported value for the same input.
- Empirical calibration: for a corpus of real multi-criteria decisions
  with known "was the top choice regretted" outcomes, does DSI correlate
  with regret rate?
