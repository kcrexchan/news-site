#!/usr/bin/env python3
"""Replace all hardcoded hex colors in static pages with CSS variables."""
import os, re

pages = [
    "pages/index.jsx", "pages/admin.jsx", "pages/breakout.jsx", "pages/digest.jsx",
    "pages/games.jsx", "pages/income.jsx", "pages/reddit.jsx", "pages/tetris.jsx",
]

# All hex colors found in the project, mapped to CSS variables
HEX_TO_VAR = {
    '#0a0e1a': 'var(--bg-primary)',
    '#f8fafc': 'var(--bg-secondary)',
    '#ffffff': 'var(--text-primary)',
    '#e2e8f0': 'var(--text-primary)',
    '#1a1a1a': 'var(--bg-card)',
    '#1e1b4b': 'var(--bg-secondary)',
    '#0f172a': 'var(--text-primary)',
    '#64748b': 'var(--text-secondary)',
    '#94a3b8': 'var(--text-muted)',
    '#a0a0a0': 'var(--text-secondary)',
    '#ec4899': 'rgba(236, 72, 153, 0.3)',
    '#38bdf8': 'rgba(56, 189, 248, 0.3)',
    '#8b5cf6': 'var(--accent-secondary)',
    '#0ea5e9': 'rgba(14, 165, 233, 0.3)',
    '#ef4444': 'rgba(239, 68, 68, 0.3)',
    '#22c55e': 'var(--accent-secondary)',
    '#3b82f6': 'rgba(59, 130, 246, 0.3)',
    '#7c3aed': 'rgba(124, 58, 237, 0.3)',
    '#f093fb': '#fce7f3',
    '#f5576c': '#fecfef',
    '#4facfe': 'var(--accent-primary)',
    '#ffffff': 'white',
    '#6b7280': 'var(--text-secondary)',
    '#4b5563': 'var(--text-muted)',
    '#fafbfc': '#fef3c7',
    '#f9fafb': 'white',
    '#74b9ff': 'rgba(116, 185, 255, 0.3)',
    '#a0c4ff': '#e0e0e0',
    '#88c0d0': 'var(--text-secondary)',
    '#fdd8dc': '#fecfef',
    '#9ca3af': 'var(--text-muted)',
    '#cbd5e1': 'var(--text-muted)',
    '#a8a29e': '#4b5563',
    '#d4d3dc': 'var(--text-muted)',
    '#ffffff': 'white',
    '#0f172a': '#111827',
    '#1a1a1a': 'var(--bg-card)',
    '#333333': 'var(--border-color)',
    '#22c55e': 'rgba(34, 197, 94, 0.3)',
}

print("Replacing hex colors with CSS variables...")
for p in pages:
    if not os.path.exists(p): continue
    with open(p, encoding='utf-8') as f:
        content = f.read()
    changed = False
    for hex_c, new_val in HEX_TO_VAR.items():
        pattern = rf'\"#{hex_c}\"'
        count = content.count(pattern)
        if count > 0:
            content = content.replace(pattern, str(new_val))
            changed = True
            print(f"  {p}: replaced {count} occurrence(s) of #{hex_c}")
    if not changed:
        print(f"  - {p} (no changes)")

print("\nDone.")

if __name__ == '__main__':
    main()
PYEOF