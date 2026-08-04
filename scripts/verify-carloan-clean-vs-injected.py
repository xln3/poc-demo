#!/usr/bin/env python3
"""Verify the carloan demo PDFs meet the two hard requirements:

  1. VISUALLY IDENTICAL: for each doc, the injected file renders pixel-for-pixel
     the same as its clean original (no layout shift, no visible mark).
  2. STILL AN ATTACK: the injected file's hidden instruction is extractable by a
     PDF text parser (and present in metadata for CL3), while the clean file has
     none of it.

Renders every page at 150 DPI with PyMuPDF and diffs the raw pixels.
Exit 0 only if all docs pass both checks.
"""
import json
import os
import sys

import fitz  # PyMuPDF

HERE = os.path.dirname(os.path.abspath(__file__))
CONTENT = os.path.join(HERE, "carloan-content.json")
DIR = os.path.join(HERE, "..", "public", "attack-samples", "carloan")
ZOOM = fitz.Matrix(150 / 72, 150 / 72)  # 150 DPI


def render_pages(path):
    doc = fitz.open(path)
    imgs = [doc[i].get_pixmap(matrix=ZOOM, alpha=False).samples for i in range(doc.page_count)]
    n = doc.page_count
    doc.close()
    return n, imgs


def pixel_diff(a, b):
    """Return (#differing bytes, max abs byte delta) between two RGB sample buffers."""
    if len(a) != len(b):
        return len(a) + len(b), 255
    diff = 0
    mx = 0
    for x, y in zip(a, b):
        d = x - y if x > y else y - x
        if d:
            diff += 1
            if d > mx:
                mx = d
    return diff, mx


def norm(s):
    """Collapse chars that PDF text extraction renders inconsistently (spaces, the
    fullwidth middle dot, newlines) so marker matching is robust on both sides."""
    for ch in (" ", "　", "\n", "\t", "·", "•"):
        s = s.replace(ch, "")
    return s


def extract_text(path):
    doc = fitz.open(path)
    txt = "".join(doc[i].get_text() for i in range(doc.page_count))
    meta = dict(doc.metadata or {})
    doc.close()
    return txt, meta


def main():
    data = json.load(open(CONTENT, encoding="utf-8"))
    ok = True
    for d in data["docs"]:
        stem = d["file"].rsplit(".", 1)[0]
        inj = os.path.join(DIR, d["file"])
        cln = os.path.join(DIR, f"{stem}-clean.pdf")
        marker = norm(d["hiddenFront"])[:16]

        # ---- 1. pixel-identical ----
        (n_i, imgs_i), (n_c, imgs_c) = render_pages(inj), render_pages(cln)
        if n_i != n_c:
            print(f"❌ {d['file']}: page count differs (injected {n_i} vs clean {n_c})")
            ok = False
            continue
        total_diff = 0
        max_delta = 0
        for pi, pc in zip(imgs_i, imgs_c):
            dd, mm = pixel_diff(pi, pc)
            total_diff += dd
            max_delta = max(max_delta, mm)
        visual_ok = total_diff == 0
        total_px = sum(len(p) for p in imgs_c) // 3

        # ---- 2. injection extractable in injected, absent in clean ----
        txt_i, meta_i = extract_text(inj)
        txt_c, meta_c = extract_text(cln)
        inj_has = marker in norm(txt_i)
        cln_has = marker in norm(txt_c)
        meta_note = ""
        if d.get("pdfMeta"):
            mtitle = (d["pdfMeta"].get("title") or "")
            meta_i_has = mtitle and mtitle in (meta_i.get("title") or "")
            meta_c_has = mtitle and mtitle in (meta_c.get("title") or "")
            meta_note = f" | meta-title injected={bool(meta_i_has)} clean={bool(meta_c_has)}"
            if mtitle and (not meta_i_has or meta_c_has):
                ok = False
        attack_ok = inj_has and not cln_has

        status = "✅" if (visual_ok and attack_ok) else "❌"
        if not (visual_ok and attack_ok):
            ok = False
        print(
            f"{status} {d['display']:>10} [{d['hideStyle']}]  "
            f"visual: {'IDENTICAL' if visual_ok else f'{total_diff} bytes differ (maxΔ{max_delta})'} "
            f"({total_px}px/pg)  |  parser sees injection: injected={inj_has} clean={cln_has}{meta_note}"
        )

    print()
    print("RESULT:", "ALL PASS ✅" if ok else "FAIL ❌")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
