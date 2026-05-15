#!/usr/bin/env python3
"""
Validate consistency between KB item JSON and the canonical dependency map.

Compares hard edges declared in transition-kb/items/*.json against the hard
edges in transition-kb/_dependency-map.mmd and reports drift in four buckets.
Uses soft edges in the canonical map to classify intentionally-standalone items.

Usage:
    python3 scripts/validate_dependency_map.py
    npm run validate-deps

Never fails the build (always exits 0).  Silence means no drift.
"""

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
ITEMS_DIR = REPO_ROOT / "transition-kb" / "items"
CANONICAL = REPO_ROOT / "transition-kb" / "_dependency-map.mmd"

# The sentinel node ID as it appears in Mermaid (underscores, leading _).
SENTINEL_NODE = "_standalone"

# Regex patterns for Mermaid edge lines (node IDs: letters/digits/hyphens/underscores).
_NODE = r"[A-Za-z][A-Za-z0-9_-]*"
_HARD_RE = re.compile(rf"^\s*({_NODE})\s*-->\s*({_NODE})", re.MULTILINE)
_SOFT_RE = re.compile(rf"^\s*({_NODE})\s*-\.->\s*({_NODE})", re.MULTILINE)


def node_to_slug(node: str) -> str:
    """Convert a Mermaid node ID (underscores) back to a KB slug (hyphens).
    Leading underscore on the sentinel is preserved as-is."""
    if node == SENTINEL_NODE:
        return SENTINEL_NODE
    return node.replace("_", "-")


def load_json_edges(items: dict) -> set[tuple[str, str]]:
    """Return all hard edges as (requiring_slug, required_slug) pairs."""
    edges: set[tuple[str, str]] = set()
    for slug, item in items.items():
        for req in item.get("requires", []):
            edges.add((slug, req))
    return edges


def strip_comments(text: str) -> str:
    """Remove Mermaid comment lines (%%) before applying edge regexes."""
    return "\n".join(
        # Also strip inline trailing comments so  `a --> b  %% note` parses cleanly.
        re.sub(r"\s*%%.*$", "", line)
        for line in text.splitlines()
        if not line.lstrip().startswith("%%")
    )


def parse_canonical(
    text: str,
) -> tuple[set[tuple[str, str]], set[str]]:
    """
    Parse the canonical .mmd file.

    Returns:
        hard_edges  — set of (src_slug, dst_slug) for every --> edge found
        standalone  — set of slugs wired to the _standalone sentinel via -.->
    """
    clean = strip_comments(text)

    hard: set[tuple[str, str]] = set()
    for m in _HARD_RE.finditer(clean):
        src, dst = node_to_slug(m.group(1)), node_to_slug(m.group(2))
        hard.add((src, dst))

    standalone: set[str] = set()
    for m in _SOFT_RE.finditer(clean):
        src_node, dst_node = m.group(1), m.group(2)
        if dst_node == SENTINEL_NODE:
            standalone.add(node_to_slug(src_node))

    return hard, standalone


def main() -> None:
    # ── Load JSON items ───────────────────────────────────────────────────────
    items: dict = {}
    for path in sorted(ITEMS_DIR.glob("*.json")):
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        items[data["slug"]] = data

    json_edges = load_json_edges(items)

    # ── Check canonical exists ────────────────────────────────────────────────
    if not CANONICAL.exists():
        print(f"[validate-deps] {CANONICAL.name} not found.")
        print("  Bootstrap it:")
        print("    python3 scripts/generate_dependency_map.py")
        print(
            "    copy transition-kb\\_dependency-map.generated.mmd "
            "transition-kb\\_dependency-map.mmd"
        )
        sys.exit(0)

    canonical_text = CANONICAL.read_text(encoding="utf-8")
    canonical_hard, standalone_slugs = parse_canonical(canonical_text)

    # ── Bucket 1: hard edge in JSON, missing from canonical ───────────────────
    b1 = sorted(json_edges - canonical_hard)

    # ── Bucket 2: hard edge in canonical, missing from JSON ───────────────────
    # Exclude any edges that touch the sentinel (those are soft, design-only).
    b2 = sorted(
        (src, dst)
        for src, dst in canonical_hard - json_edges
        if dst != SENTINEL_NODE and src != SENTINEL_NODE
    )

    # ── Bucket 3: edge exists in both but direction is reversed ───────────────
    b3: list[tuple[str, str]] = []
    for src, dst in json_edges:
        if (dst, src) in canonical_hard:
            b3.append((src, dst))
    b3 = sorted(b3)

    # ── Bucket 4: isolated items not classified in canonical ──────────────────
    connected: set[str] = set()
    for src, dst in json_edges:
        connected.add(src)
        connected.add(dst)
    isolated = set(items) - connected
    b4 = sorted(isolated - standalone_slugs)

    # ── Report ────────────────────────────────────────────────────────────────
    total = len(b1) + len(b2) + len(b3) + len(b4)

    if total == 0:
        classified = len(isolated & standalone_slugs)
        print(
            f"[validate-deps] No drift detected. "
            f"{len(items)} items, {len(json_edges)} hard edges, "
            f"{classified} intentional standalone."
        )
        return

    print(f"[validate-deps] {total} item(s) need attention:\n")

    if b1:
        print(f"  Bucket 1 - In JSON, missing from canonical  ({len(b1)})")
        print("  Action: add these edges to _dependency-map.mmd\n")
        for src, dst in b1:
            print(f"    {src} --> {dst}")
        print()

    if b2:
        print(f"  Bucket 2 - In canonical, missing from JSON  ({len(b2)})")
        print(
            "  Action: add `requires` to the item JSON, "
            "or remove the stale edge from canonical\n"
        )
        for src, dst in b2:
            print(f"    {src} --> {dst}")
        print()

    if b3:
        print(f"  Bucket 3 - Edge direction reversed  ({len(b3)})")
        print("  Action: reconcile JSON and canonical manually\n")
        for src, dst in b3:
            print(f"    JSON: {src} --> {dst}")
            print(f"    Canonical has the reverse: {dst} --> {src}")
        print()

    if b4:
        print(f"  Bucket 4 - Unclassified isolated items  ({len(b4)})")
        print(
            "  Action: add a dependency edge in JSON, "
            "or wire to _standalone in the canonical map:\n"
            "      my-item -.-> _standalone\n"
        )
        for slug in b4:
            print(f"    {slug}")
        print()


if __name__ == "__main__":
    main()
