# Security Policy

## Scope

DecisionScore is a pure computation package: it takes a JSON-serializable
input (options/criteria/scores), runs deterministic and seeded-random
numeric routines over it, and returns a JSON-serializable output. It:

- performs no network I/O,
- performs no file system I/O,
- has zero runtime dependencies,
- does not `eval()` or otherwise execute code contained in its input.

This significantly limits its attack surface, but the points below still
apply.

## Reporting a Vulnerability

If you believe you've found a security issue in this repository (for
example, a crafted input that causes unbounded memory/CPU use, or a
prototype-pollution-style issue via the `scores` object), please open a
private security advisory on this repository (GitHub → Security →
Advisories → "Report a vulnerability") rather than a public issue.

Please include:

- the input that triggers the issue,
- the observed vs. expected behavior,
- the package version (`model.json` → `version`).

## Supported Versions

Only the latest published `1.x` release is actively supported until a
`2.0.0` is released, at which point this section will be updated.

## Known Limitations Relevant to Security

- Very large `options`/`criteria` arrays combined with a high
  `perturbationTrials`/small `flipSearchStep` in `execute()`'s `options`
  can increase CPU time roughly linearly in both. Callers embedding this
  package in a service that accepts untrusted input should apply their own
  timeouts and reasonable upper bounds on those parameters — this package
  does not impose limits on them itself.
- `scores` keys come from caller-supplied option/criterion ids and are used
  as plain object keys. If you accept `DecisionScoreInput` directly from
  untrusted JSON in an environment where prototype pollution via object
  keys (e.g. `"__proto__"`) is a concern for your runtime, sanitize ids
  before calling `execute()`.
