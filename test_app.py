#!/usr/bin/env python3
"""Check that the app uses the canonical diary text and the required features."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, "/workspace/story")
import nells_diary as D

# Personal name must stay off the app. The case-file URL may contain the GitHub account.
NAME_LEAKS = re.compile(r"McKean|\bRobin\b|\bRJ\b|P\.?\s?W\.?\s?R\.?\s?J", re.I)
GITHUB_OK = re.compile(r"robmac10\.github\.io/who-fired-first|#brief|RobMac10/nells-diary", re.I)
FAILS = []

def fail(msg):
    FAILS.append(msg)
    print("FAIL:", msg)

def ok(msg):
    print("ok:", msg)

def load_data():
    text = (ROOT / "assets/data.js").read_text(encoding="utf-8")
    m = re.search(r"window\.NELLS_DIARY = (\{.*\});\s*$", text, re.S)
    if not m:
        fail("data.js did not contain NELLS_DIARY")
        return {}
    return json.loads(m.group(1))

def text_of(runs):
    return "".join(r["t"] if r.get("t") != "spell" else r["wrong"] for r in runs)

def test_text_matches(data):
    assert data["title"] == D.TITLE
    assert data["sub"] == D.SUB
    assert data["strap"] == D.STRAP
    assert data["exhibit"] == D.EXHIBIT
    assert data["school"] == D.SCHOOL
    assert data["schoolPlace"] == D.SCHOOL_PLACE
    assert data["tentPlace"] == D.TENT_PLACE
    assert data["chapelCaption"] == D.CHAPEL_CAPTION
    assert data["end"] == D.END
    assert data["reveal"] == D.REVEAL
    assert data["easyRead"] == D.EASY_READ
    assert data["cta"] == "Who fired first? Open the case."
    assert data["caseUrl"] == "https://robmac10.github.io/who-fired-first/#brief"
    assert len(data["entries"]) == len(D.ENTRIES)
    for i, src in enumerate(D.ENTRIES):
        e = data["entries"][i]
        assert e["date"] == src["date"], (e["date"], src["date"])
        assert e["place"] == src["place"]
        assert e["classLabel"] == (src["class_label"] or "")
        assert len(e["paras"]) == len(src["paras"])
        notes_by = dict(src.get("notes") or [])
        for j, para in enumerate(src["paras"]):
            got = text_of(e["paras"][j]["runs"])
            want = "".join(r if isinstance(r, str) else r[1] for r in para)
            assert got == want, (e["id"], j, got, want)
            spells_src = [r for r in para if not isinstance(r, str)]
            spells_got = [r for r in e["paras"][j]["runs"] if r.get("t") == "spell"]
            assert len(spells_got) == len(spells_src)
            for g, s in zip(spells_got, spells_src):
                assert g["wrong"] == s[1] and g["right"] == s[2]
            if j in notes_by:
                assert e["paras"][j]["note"]["text"] == notes_by[j]
            else:
                assert "note" not in e["paras"][j]
    assert [(b["head"], b["body"]) for b in data["teacher"]] == list(D.NOTE)
    assert len(data["notes"]) == 9
    assert len(data["pages"]) == 14
    assert data["pages"][0]["type"] == "cover"
    assert data["pages"][1]["type"] == "flyleaf"
    last = data["pages"][-1]
    assert last["last"] is True and last["entry"] == "e6"
    ok("canonical diary text and pagination match")

def test_files():
    for rel in [
        "index.html", "sw.js", "manifest.webmanifest", ".nojekyll", "README.md",
        "assets/style.css", "assets/app.js", "assets/data.js",
        "assets/chapel-school.jpg", "assets/chapel-school-large.jpg",
        "assets/smudge-ink.png", "assets/blot-1.png", "assets/blot-2.png", "assets/blot-3.png",
        "assets/fonts/CedarvilleCursive-Regular.ttf",
        "assets/fonts/Italianno-Regular.ttf",
        "assets/fonts/Kalam-Regular.ttf",
    ]:
        if not (ROOT / rel).is_file():
            fail("missing " + rel)
    ok("required files present")

def test_html_features():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "assets/style.css").read_text(encoding="utf-8")
    js = (ROOT / "assets/app.js").read_text(encoding="utf-8")
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    blob = html + css + js + readme
    student = html + css + js + (ROOT / "assets/data.js").read_text(encoding="utf-8")
    scrubbed = re.sub(r"https?://robmac10\.github\.io/\S+", "", student, flags=re.I)
    if NAME_LEAKS.search(scrubbed):
        fail("author name appears in app files: " + NAME_LEAKS.search(scrubbed).group(0))
    else:
        ok("no personal name in student-facing app files")
    for needle, label in [
        ("For teachers: what’s true?", "teacher panel"),
        ("Detective’s notebook", "notebook"),
        ("easy-read", "easy-read toggle"),
        ("chapel-lightbox", "lightbox"),
        ("localStorage", "localStorage answers"),
        ("Seen it myself", "evidence tag"),
        ("Heard it", "evidence tag heard"),
        ("Not sure", "evidence tag unsure"),
        ("who-fired-first/#brief", "case file link"),
        ("Cedarville Cursive", "Nell's font"),
        ("Italianno", "Hayes font"),
        ("Kalam", "easy-read font"),
        ('lang="en-AU"', "language"),
        ("Skip to the diary", "skip link"),
        ("serviceWorker", "service worker register"),
        ("ArrowRight", "keyboard"),
        ("prefers-reduced-motion", "reduced motion"),
    ]:
        if needle not in blob:
            fail("missing feature: " + label)
    # diary pages must not carry invented labels
    if re.search(r"invented", (ROOT / "index.html").read_text(encoding="utf-8") + js, re.I):
        # teacher panel may mention invented people; that is allowed in the teacher note (in data.js)
        # but the page template / js must not stamp 'invented' onto diary leaves
        if "invented" in js.lower() and "renderDiary" in js:
            # only fail if renderDiary injects the word
            diary_fn = js[js.find("function renderDiary"):js.find("function renderPage")]
            if "invented" in diary_fn.lower():
                fail("invented label in diary page renderer")
    ok("required features present in the shell")

def test_places():
    data = load_data()
    class_places = {e["place"] for e in data["entries"] if e["classLabel"]}
    tent_places = {e["place"] for e in data["entries"] if not e["classLabel"]}
    if class_places != {D.SCHOOL_PLACE}:
        fail("class entries should be headed " + D.SCHOOL_PLACE + " got " + repr(class_places))
    if tent_places != {D.TENT_PLACE}:
        fail("tent entries should be headed " + D.TENT_PLACE + " got " + repr(tent_places))
    ok("place headings are school vs tent as in the source")

def main():
    data = load_data()
    try:
        test_files()
        test_text_matches(data)
        test_html_features()
        test_places()
    except AssertionError as e:
        fail("assertion: " + str(e))
    if FAILS:
        print(len(FAILS), "failure(s)")
        sys.exit(1)
    print("all tests passed")

if __name__ == "__main__":
    main()
