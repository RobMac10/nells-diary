#!/usr/bin/env python3
"""Generate assets/data.js from the canonical Nell's Diary source. Do not invent text."""
import json
import sys
from pathlib import Path

sys.path.insert(0, "/workspace/story")
import nells_diary as D

CHAPEL_ALT = (
    "Eugene von Guérard, Catholic Chapel on the Gravel Pit Line, Ballarat, "
    "January 1854. Pen and sepia ink drawing of the slab-and-canvas St Alipius chapel. "
    "State Library of Victoria, H12532."
)

CASE_URL = "https://robmac10.github.io/who-fired-first/#brief"
CTA = "Who fired first? Open the case."

# Lined pages after the cover and flyleaf. Splits are layout only; the text is unchanged.
PAGE_SPLITS = [
    ("e0", 0, 3, True),
    ("e0", 4, 7, False),
    ("e1", 0, 3, True),
    ("e1", 4, 6, False),
    ("e2", 0, 1, True),
    ("e3", 0, 2, True),
    ("e3", 3, 6, False),
    ("e4", 0, 3, True),
    ("e5", 0, 3, True),
    ("e5", 4, 5, False),
    ("e6", 0, 4, True),
    ("e6", 5, 6, False),
]


def runs_of(para):
    out = []
    for r in para:
        if isinstance(r, str):
            out.append({"t": r})
        else:
            out.append({"t": "spell", "wrong": r[1], "right": r[2]})
    return out


def build():
    entries = []
    notes_index = []
    for i, src in enumerate(D.ENTRIES):
        eid = f"e{i}"
        notes_by = dict(src.get("notes") or [])
        paras = []
        for j, para in enumerate(src["paras"]):
            pid = f"{eid}p{j}"
            rec = {"id": pid, "runs": runs_of(para)}
            if j in notes_by:
                nid = f"{eid}n{j}"
                rec["note"] = {"id": nid, "text": notes_by[j]}
                notes_index.append({
                    "id": nid,
                    "entry": eid,
                    "para": pid,
                    "date": src["date"],
                    "text": notes_by[j],
                })
            paras.append(rec)
        entries.append({
            "id": eid,
            "date": src["date"],
            "place": src["place"],
            "classLabel": src["class_label"] or "",
            "paras": paras,
        })

    by_id = {e["id"]: e for e in entries}
    pages = [{"type": "cover"}, {"type": "flyleaf"}]
    for eid, a, b, heading in PAGE_SPLITS:
        e = by_id[eid]
        nparas = len(e["paras"])
        if a < 0 or b >= nparas or a > b:
            raise SystemExit(f"bad split {eid} {a}-{b} of {nparas}")
        pages.append({
            "type": "diary",
            "entry": eid,
            "from": a,
            "to": b,
            "heading": heading,
            "last": eid == "e6" and b == nparas - 1,
        })

    data = {
        "title": D.TITLE,
        "sub": D.SUB,
        "strap": D.STRAP,
        "exhibit": D.EXHIBIT,
        "school": D.SCHOOL,
        "schoolPlace": D.SCHOOL_PLACE,
        "tentPlace": D.TENT_PLACE,
        "chapelCaption": D.CHAPEL_CAPTION,
        "chapelAlt": CHAPEL_ALT,
        "end": D.END,
        "cta": CTA,
        "caseUrl": CASE_URL,
        "reveal": D.REVEAL,
        "easyRead": D.EASY_READ,
        "teacher": [{"head": h, "body": b} for h, b in D.NOTE],
        "entries": entries,
        "notes": notes_index,
        "pages": pages,
    }

    out = Path("/workspace/nells-diary-app/assets/data.js")
    payload = json.dumps(data, ensure_ascii=False, indent=2)
    out.write_text("/* Generated from /workspace/story/nells_diary.py — do not edit by hand. */\n"
                   "window.NELLS_DIARY = " + payload + ";\n", encoding="utf-8")
    print("wrote", out, "pages", len(pages), "entries", len(entries), "notes", len(notes_index))


if __name__ == "__main__":
    build()
