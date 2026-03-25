#!/usr/bin/env python3
"""ralph.py — OpenSpec task loop for opencode.

Drives opencode once per task in the change's task list. Each iteration runs
`opencode run --format json`, streams agent output to the terminal in real-time,
and parses the JSON event stream for token/cost usage. Prints a per-iteration
summary table on completion.

Run directly or via the ralph.sh wrapper.
"""

import argparse
import json
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

# Assumed context window size when the model doesn't report one explicitly.
CONTEXT_WINDOW_DEFAULT = 200_000


# ── Data ──────────────────────────────────────────────────────────────────────

@dataclass
class IterationStats:
    iteration: int
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    context_window: int = CONTEXT_WINDOW_DEFAULT
    completed: bool = False   # saw <promise>COMPLETE</promise>
    duration_s: float = 0.0

    @property
    def context_pct(self) -> float | None:
        if not self.input_tokens:
            return None
        return (self.input_tokens / self.context_window) * 100


# ── JSON event helpers ────────────────────────────────────────────────────────

def _find_field(obj: dict, *keys: str):
    """Search a dict (one level deep) for the first matching key."""
    if not isinstance(obj, dict):
        return None
    for k in keys:
        if k in obj:
            return obj[k]
    for v in obj.values():
        if isinstance(v, dict):
            result = _find_field(v, *keys)
            if result is not None:
                return result
    return None


def extract_usage(event: dict) -> tuple[int, int, float, int]:
    """
    Opportunistically extract token/cost info from a JSON event.

    Handles the opencode native format where tokens/cost are nested under
    event["part"]["tokens"] and event["part"]["cost"], as well as generic
    field name variants used by other providers.
    Returns (input_tokens, output_tokens, cost_usd, context_window).
    Any field not found returns 0/0.0.
    """
    part   = event.get("part") if isinstance(event.get("part"), dict) else {}
    tokens = part.get("tokens") if isinstance(part.get("tokens"), dict) else {}

    inp  = (tokens.get("input")
            or _find_field(event, "input_tokens", "inputTokens", "prompt_tokens", "promptTokens")
            or 0)
    out  = (tokens.get("output")
            or _find_field(event, "output_tokens", "outputTokens", "completion_tokens", "completionTokens")
            or 0)
    cost = (part.get("cost")
            or _find_field(event, "cost", "totalCost", "total_cost", "costUsd", "cost_usd")
            or 0.0)
    ctx  = _find_field(event, "context_window", "contextWindow", "context_length", "max_tokens", "maxTokens") or 0
    return int(inp), int(out), float(cost), int(ctx)


def _text_from_event(event: dict) -> str:
    """Extract printable text content from a JSON event, handling known shapes."""
    event_type = event.get("type", "")

    if event_type in ("text", "content"):
        # opencode native format: text is under event["part"]["text"]
        part = event.get("part")
        if isinstance(part, dict):
            text = part.get("text") or part.get("content") or ""
            if text:
                return text
        return event.get("text") or event.get("content") or ""

    if event_type == "content_block_delta":
        delta = event.get("delta", {})
        if isinstance(delta, dict):
            return delta.get("text") or delta.get("content") or ""

    if event_type == "message":
        content = event.get("content") or event.get("text") or ""
        if isinstance(content, list):
            return "".join(
                b.get("text", "") for b in content
                if isinstance(b, dict) and b.get("type") == "text"
            )
        return str(content) if content else ""

    return ""


# ── Core loop ─────────────────────────────────────────────────────────────────

def run_iteration(
    iteration: int,
    prompt: str,
    model: str,
    max_iters: int,
) -> IterationStats:
    stats = IterationStats(iteration=iteration)
    t_start = time.monotonic()

    cmd = ["opencode", "run", "--format", "json"]
    if model:
        cmd += ["-m", model]
    cmd.append(prompt)

    print(f"\n{'=' * 64}")
    print(f"  Iteration {iteration} of {max_iters}")
    print(f"{'=' * 64}", flush=True)

    text_chunks: list[str] = []

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=None,    # let opencode's stderr flow through to the terminal directly
            text=True,
            bufsize=1,
        )

        for raw_line in proc.stdout:
            raw_line = raw_line.rstrip("\n")
            if not raw_line:
                continue

            # Parse JSON; if it fails, treat the line as plain text
            try:
                event = json.loads(raw_line)
            except json.JSONDecodeError:
                print(raw_line, flush=True)
                text_chunks.append(raw_line)
                continue

            # Stream visible text so the user sees agent output in real-time
            text = _text_from_event(event)
            if text:
                print(text, end="", flush=True)
                text_chunks.append(text)

            # Opportunistically harvest usage data from every event.
            # We take the max across events because many tools emit cumulative
            # running totals (later events have higher numbers).
            inp, out, cost, ctx = extract_usage(event)
            if inp:  stats.input_tokens  = max(stats.input_tokens,  inp)
            if out:  stats.output_tokens = max(stats.output_tokens, out)
            if cost: stats.cost_usd      = max(stats.cost_usd,      cost)
            if ctx:  stats.context_window = ctx

        proc.wait()

    except Exception as e:
        print(f"\n[ralph] Error running opencode: {e}", file=sys.stderr)

    stats.duration_s = time.monotonic() - t_start
    print(flush=True)   # ensure a newline after streamed output

    if "<promise>COMPLETE</promise>" in "".join(text_chunks):
        stats.completed = True

    return stats


# ── Summary table ─────────────────────────────────────────────────────────────

def _fmt_duration(seconds: float) -> str:
    if seconds < 60:
        return f"{seconds:.1f}s"
    m, s = divmod(int(seconds), 60)
    return f"{m}m{s:02d}s"


def print_summary(all_stats: list[IterationStats], change_id: str) -> None:
    has_tokens = any(s.input_tokens or s.output_tokens for s in all_stats)

    W = dict(iter=4, inp=12, out=12, cost=9, ctx=7, time=8)

    header = (
        f"{'Iter':>{W['iter']}}  "
        f"{'Input Tok':>{W['inp']}}  "
        f"{'Output Tok':>{W['out']}}  "
        f"{'Cost':>{W['cost']}}  "
        f"{'Ctx %':>{W['ctx']}}  "
        f"{'Time':>{W['time']}}  "
        f"Status"
    )
    sep = "─" * len(header)

    print(f"\n{'═' * 70}")
    print(f"  Ralph Summary — {change_id}")
    print(f"{'═' * 70}")
    print(header)
    print(sep)

    total_inp = total_out = 0
    total_cost = 0.0
    total_time = 0.0

    for s in all_stats:
        status   = "COMPLETE" if s.completed else "—"
        ctx_str  = f"{s.context_pct:.1f}%" if s.context_pct is not None else "—"
        cost_str = f"${s.cost_usd:.4f}"    if s.cost_usd   else "—"
        inp_str  = f"{s.input_tokens:,}"   if s.input_tokens  else "—"
        out_str  = f"{s.output_tokens:,}"  if s.output_tokens else "—"
        time_str = _fmt_duration(s.duration_s)
        print(
            f"{s.iteration:>{W['iter']}}  "
            f"{inp_str:>{W['inp']}}  "
            f"{out_str:>{W['out']}}  "
            f"{cost_str:>{W['cost']}}  "
            f"{ctx_str:>{W['ctx']}}  "
            f"{time_str:>{W['time']}}  "
            f"{status}"
        )
        total_inp  += s.input_tokens
        total_out  += s.output_tokens
        total_cost += s.cost_usd
        total_time += s.duration_s

    print(sep)
    total_cost_str = f"${total_cost:.4f}" if total_cost else "—"
    print(
        f"{'TOT':>{W['iter']}}  "
        f"{total_inp:>{W['inp']},}  "
        f"{total_out:>{W['out']},}  "
        f"{total_cost_str:>{W['cost']}}  "
        f"{'':>{W['ctx']}}  "
        f"{_fmt_duration(total_time):>{W['time']}}  "
    )
    print()

    if not has_tokens:
        print("  Note: token/cost columns are empty — no usage data was found in the")
        print("        opencode JSON event stream.")
        print("        Check `opencode run --format json` raw output")


# ── Entry point ───────────────────────────────────────────────────────────────

def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="ralph",
        description="Ralph — OpenSpec task loop for opencode",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
examples:
  ralph.sh auth-refactor
  ralph.sh auth-refactor -m anthropic/claude-sonnet-4-6
  ralph.sh auth-refactor -m anthropic/claude-sonnet-4-6 10
""",
    )
    parser.add_argument(
        "change_id",
        metavar="change-id",
        help="OpenSpec change ID to work through",
    )
    parser.add_argument(
        "-m", "--model",
        default="",
        help="Model to use (e.g. anthropic/claude-sonnet-4-6)",
    )
    parser.add_argument(
        "max_iterations",
        nargs="?",
        type=int,
        default=20,
        metavar="max_iterations",
        help="Maximum task iterations (default: 20)",
    )
    return parser


def main() -> int:
    args = build_arg_parser().parse_args()

    template_path = Path(__file__).parent / "RALPH.md"
    if not template_path.exists():
        print(f"Error: prompt template not found: {template_path}", file=sys.stderr)
        return 1

    prompt = template_path.read_text().replace("{{CHANGE_ID}}", args.change_id)

    model_label = f" — Model: {args.model}" if args.model else ""
    print(
        f"Starting Ralph"
        f" — Change: {args.change_id}"
        f" — Max iterations: {args.max_iterations}"
        f"{model_label}"
    )

    all_stats: list[IterationStats] = []
    completed = False

    for i in range(1, args.max_iterations + 1):
        stats = run_iteration(i, prompt, args.model, args.max_iterations)
        all_stats.append(stats)

        if stats.completed:
            print(f"\nRalph completed all tasks for change: {args.change_id}")
            print(f"Finished at iteration {i} of {args.max_iterations}")
            completed = True
            break

        print(f"Iteration {i} complete. Continuing...")
        time.sleep(2)

    if not completed:
        print(
            f"\nRalph reached max iterations ({args.max_iterations}) without completing all tasks."
            "\nCheck tasks.md and progress.txt for status."
        )

    print_summary(all_stats, args.change_id)
    return 0 if completed else 1


if __name__ == "__main__":
    sys.exit(main())
