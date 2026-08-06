#!/usr/bin/env python3
import os, re

pages = [
    "pages/index.jsx", "pages/admin.jsx", "pages/breakout.jsx", "pages/digest.jsx",
    "pages/games.jsx", "pages/income.jsx", "pages/reddit.jsx", "pages/tetris.jsx",
]

hex_map = {
    '#0a0e1a': 'var(--bg-primary)', '#f8fafc': 'var(--bg-secondary)',
    '#ffffff': 'var(--text-primary)', '#e2e8f0': 'var(--text-primary)',
    '#1a1a1a': 'var(--bg-card)', '#1e1b4b': 'var(--bg-secondary)',
    '#0f172a': 'var(--text-primary)', '#64748b': 'var(--text-secondary)',
    '#94a3b8': 'var(--text-muted)', '#a0a0a0': 'var(--text-secondary)',
    '#ec4899': "rgba(236, 72, 153, 0.3)", '#38bdf8': "rgba(56, 189, 248, 0.3)",
    '#8b5cf6': 'var(--accent-secondary)', '#0ea5e9': "rgba(14, 165, 233, 0.3)",
    '#ef4444': "rgba(239, 68, 68, 0.3)", '#22c55e': 'var(--accent-secondary)',
    '#3b82f6': "rgba(59, 130, 246, 0.3)", '#7c3aed': "rgba(124, 58, 237, 0.3)",
    '#f093fb': '#fce7f3', '#f5576c': '#fecfef', '#4facfe': 'var(--accent-primary)',
    '#ffffff': 'white', '#6b7280': 'var(--text-secondary)', '#4b5563': 'var(--text-muted)',
    '#fafbfc': '#fef3c7', '#f9fafb': 'white', '#74b9ff': "rgba(116, 185, 255, 0.3)",
    '#a0c4ff': '#e0e0e0', '#88c0d0': 'var(--text-secondary)', '#fdd8dc': '#fecfef',
}

print("Replacing hex colors with CSS variables...")
for p in pages:
    if not os.path.exists(p): continue
    with open(p, encoding='utf-8') as f: content = f.read()
    changed = False
    for hex_c in hex_map:
        pattern = rf'\"#{hex_c}\"'
        new_val = str(hex_map[hex_c])
        count = content.count(pattern)
        if count > 0:
            content = content.replace(pattern, new_val)
            changed = True

    if changed:
        with open(p, encoding='utf-8') as f: f.write(content)
        print(f"  + {p}")
    else:
        print(f"  - {p} (no changes)")

print("Done.")