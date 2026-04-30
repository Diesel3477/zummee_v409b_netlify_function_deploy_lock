import glob, re, pathlib

LAYOUT_STYLE = '''<style id="zummeeSubpageHeaderLayoutV1216">
  /* Compact, clean subpage header layout (v1216) */
  header.zummee-header--subpage .zummee-header__controls{
    flex-direction: column !important;
    align-items: flex-end !important;
    justify-content: flex-end !important;
    gap: 10px !important;
  }
  header.zummee-header--subpage .zummee-header__communityRow{ justify-content:flex-end !important; }
  #zummeeCommunitySwatch{
    display:inline-block !important;
    width:12px !important;
    height:12px !important;
    border-radius:999px !important;
    border:2px solid rgba(255,255,255,0.70) !important;
    background: rgba(255,255,255,0.15) !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.18) !important;
  }
  header.zummee-header--subpage .zummee-header__action--hub{ align-self:flex-end !important; }
</style>
'''

HUB_ANCHOR = '<a href="index.html" class="zummee-header__action zummee-header__action--hub" style="display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border-radius:14px;font-weight:800;line-height:1;text-decoration:none;background:#ffffff;color:#0f2f4a;border:1px solid rgba(15,47,74,0.22);box-shadow:0 6px 18px rgba(0,0,0,0.10);">Hub</a>'

files = [f for f in glob.glob('*.html') if pathlib.Path(f).name != 'index.html']
changed = 0

for f in files:
    txt = pathlib.Path(f).read_text(encoding='utf-8', errors='ignore')
    if 'zummee-header--subpage' not in txt:
        continue
    orig = txt

    # Remove legacy local hub buttons that point back to index
    txt = re.sub(r'\s*<a\s+class="btn"\s+href="index\.html">Hub</a>\s*', '', txt)

    # Insert layout style after the force style block (if present)
    if 'zummeeSubpageHeaderLayoutV1216' not in txt:
        m = re.search(r'(<style id="zummeeSubpageHeaderForce">[\s\S]*?</style>\s*)', txt)
        if m:
            insert_at = m.end(1)
            txt = txt[:insert_at] + LAYOUT_STYLE + txt[insert_at:]

    # Normalize controls style (if exact string exists)
    txt = txt.replace(
        'style="width:100%;display:flex;align-items:center;justify-content:flex-end;gap:12px;flex-wrap:wrap;"',
        'style="width:100%;display:flex;align-items:flex-end;justify-content:flex-end;gap:10px;flex-wrap:wrap;"'
    )

    # Reorder inside controls: community row first, hub second
    # Pattern: controls open then hub anchor then communityRow div
    pattern = re.compile(
        r'(<div class="zummee-header__controls"[^>]*>\s*)'
        r'(<a href="index\.html" class="zummee-header__action zummee-header__action--hub"[\s\S]*?>Hub</a>\s*)'
        r'(<div class="zummee-header__communityRow"[\s\S]*?</div>)',
        re.MULTILINE
    )

    def repl(m):
        # Keep communityRow block as-is, but replace hub anchor with canonical styling to avoid weird inheritance
        return m.group(1) + m.group(3) + "\n    " + HUB_ANCHOR

    txt = re.sub(pattern, repl, txt)

    # If controls has community row but no hub at all, append it (rare)
    if 'zummee-header__controls' in txt and 'zummee-header__action--hub' not in txt:
        txt = re.sub(r'(<div class="zummee-header__controls"[^>]*>[\s\S]*?</div>\s*</header>)',
                     lambda mm: mm.group(1).replace('</div>\n</header>', f'    {HUB_ANCHOR}\n  </div>\n</header>'),
                     txt, count=1)

    if txt != orig:
        pathlib.Path(f).write_text(txt, encoding='utf-8')
        changed += 1

print(f"Updated {changed} subpage html files")
