#!/usr/bin/env python3
import re
from pathlib import Path

OUT_DIR = "out"
COLOR_MAP = {
    '#0a0e1a': ('var(--bg-primary)', 'var(--text-primary)'),
    '#f8fafc': 'var(--bg-secondary)',
    '#ffffff': 'var(--text-primary)',
    '#e2e8f0': 'var(--text-primary)',
    '#1a1a1a': 'var(--bg-card)',
    '#1e1b4b': 'var(--bg-secondary)',
    '#0f172a': 'var(--text-primary)',
    '#64748b': 'var(--text-secondary)',
    '#94a3b8': 'var(--text-muted)',
    '#a0a0a0': 'var(--text-secondary)',
    '#cbd5e1': 'var(--text-secondary)',
    '#ec4899': ('var(--accent-primary)', 'rgba(236, 72, 153, 0.3)'),
    '#38bdf8': ('var(--accent-primary)', 'rgba(56, 189, 248, 0.3)'),
    '#8b5cf6': 'var(--accent-secondary)',
    '#0ea5e9': ('var(--accent-primary)', 'rgba(14, 165, 233, 0.3)'),
    '#ef4444': ('var(--accent-primary)', 'rgba(239, 68, 68, 0.3)'),
    '#22c55e': 'var(--accent-secondary)',
    '#3b82f6': ('var(--accent-primary)', 'rgba(59, 130, 246, 0.3)'),
    '#7c3aed': ('var(--accent-secondary)', 'rgba(124, 58, 237, 0.3)'),
    '#0ea5e9': ('var(--accent-primary)', 'rgba(14, 165, 233, 0.3)'),
    '#fdd8dc': ('#fde6e3', 'rgba(253, 230, 242, 0.3)'),
    '#a7c4a0': ('var(--accent-secondary)', 'rgba(139, 92, 246, 0.3)'),
    '#8a8a8a': 'var(--text-muted)',
    '#5d7a5e': ('#14532d', 'rgba(20, 83, 45, 0.3)'),
    '#bf7c00': ('#b45309', 'rgba(180, 83, 9, 0.3)'),
    '#ff9800': ('#fb923c', 'rgba(251, 146, 60, 0.3)'),
    '#ffa726': ('#fcd34d', 'rgba(252, 211, 53, 0.3)'),
    '#ffbb8a': ('#fef9c3', 'rgba(254, 249, 195, 0.3)'),
    '#6b9e4a': ('#166534', 'rgba(22, 101, 52, 0.3)'),
    '#3d5a2e': 'var(--text-muted)',
    '#ecfccb': ('var(--accent-secondary)', 'rgba(34, 197, 94, 0.3)'),
    '#88c0d0': ('#2dd4bf', 'rgba(45, 212, 191, 0.3)'),
    '#e0e0e0': 'var(--text-primary)',
    '#ec4899': ('var(--accent-secondary)', 'rgba(236, 72, 153, 0.3)'),
    '#f093fb': ('#fce7f3', 'rgba(252, 231, 243, 0.3)'),
    '#f5576c': ('#fecfef', 'rgba(254, 239, 251, 0.3)'),
    '#4facfe': ('#dbeafe', 'rgba(219, 230, 255, 0.3)'),
    '#6ba3ff': ('#a5b4fc', 'rgba(165, 180, 252, 0.3)'),
    '#1e3a5f': ('#475569', 'rgba(71, 85, 105, 0.3)'),
    '#333333': 'var(--border-color)',
    '#4a90d9': ('var(--accent-primary)', 'rgba(56, 189, 248, 0.3)'),
    '#6ba3ff': ('#a5b4fc', 'rgba(165, 180, 252, 0.3)'),
    '#ecf0f1': 'var(--text-primary)',
    '#9ca3af': 'var(--text-secondary)',
    '#e5e7eb': ('#cbd5e1', 'rgba(205, 215, 235, 0.3)'),
    '#a8a29e': '#78716c',
    '#d4d3dc': 'var(--text-muted)',
    '#f3f4f6': ('#fef3c7', 'rgba(254, 243, 199, 0.3)'),
    '#fbf8ff': ('#ede9fe', 'rgba(237, 233, 254, 0.3)'),
    '#fefbbf': ('#fffbeb', 'rgba(255, 251, 187, 0.3)'),
    '#ffffff': 'var(--text-primary)',
}

def escape_html(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    changed = False
    for hex_color, replacement in COLOR_MAP.items():
        old_str = escape_html(hex_color)
        
        # Match quoted hex colors
        pattern = rf'"{hex_color}"'
        match = re.search(pattern, content)
        if match:
            content = content.replace(match.group(), replacement)
            changed = True
        
    # Also try unquoted hex colors (less reliable but catches some cases)
    for hex_color, replacement in COLOR_MAP.items():
        pattern = rf'\b{hex_color}\b'
        if re.search(pattern, content):
            content = content.replace(hex_color, replacement)
            changed = True

    return changed, content

def main():
    out_dir = Path(OUT_DIR)
    if not out_dir.exists():
        print(f"Warning: {OUT_DIR} does not exist. Skipping.")
        return
    
    files_processed = 0
    files_changed = 0
    
    for html_file in sorted(out_dir.rglob('*.html')):
        changed, new_content = process_file(str(html_file))
        if changed:
            with open(html_file, 'w', encoding='utf-8') as f:
                f.write(new_content)
            files_changed += 1
        files_processed += 1
    
    print(f"Processed {files_processed} HTML files, {files_changed} modified.")

if __name__ == '__main__':
    main()
