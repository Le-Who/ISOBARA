"""Build and package the current offline game without touching historical evidence."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import subprocess
import zipfile


ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
DEST = ROOT / "output" / "releases"
PREFIX = f"ISOBARA-{VERSION}"
INCLUDE_FILES = (
    "AGENTS.md", "ASSETS.md", "LICENSE", "README.md", "TEST_REPORT.md",
    "roadmap.md", "package.json", "package-lock.json", "START_GAME.cmd",
    "START_LOCAL_SERVER.cmd", "START_GAME.ps1",
)
INCLUDE_DIRS = ("dist", "docs", "evidence", "public", "src", "tests", "tools")
EXCLUDE_PARTS = {"__pycache__", "fixtures", ".test-build", "node_modules"}
EXCLUDE_SUFFIXES = {".pyc", ".pyo", ".log"}


def run(*args: str) -> None:
    executable = args[0] + ".cmd" if os.name == "nt" and args[0] == "npm" else args[0]
    subprocess.run((executable, *args[1:]), cwd=ROOT, check=True)


def source_files() -> list[Path]:
    missing = [name for name in INCLUDE_FILES if not (ROOT / name).is_file()]
    if missing:
        raise FileNotFoundError(f"Required release files are missing: {', '.join(missing)}")
    files = [ROOT / name for name in INCLUDE_FILES]
    for name in INCLUDE_DIRS:
        folder = ROOT / name
        if folder.is_dir():
            files.extend(p for p in folder.rglob("*") if p.is_file()
                         and not EXCLUDE_PARTS.intersection(p.relative_to(ROOT).parts)
                         and p.suffix.lower() not in EXCLUDE_SUFFIXES)
    return sorted(set(files), key=lambda p: p.relative_to(ROOT).as_posix())


def main() -> None:
    run("npm", "run", "check")
    run("npm", "test")
    run("npm", "run", "build")
    run("node", "--check", "dist/game.js")
    html = ROOT / "dist" / "Isobara.html"
    if html.stat().st_size < 100_000:
        raise RuntimeError("The autonomous HTML build is missing or incomplete")
    files = source_files()
    if sum(p.parent == ROOT / "public" / "assets" and p.suffix == ".webp" for p in files) < 12:
        raise RuntimeError("Local image assets are missing from the release")
    visual_assets = {f"public/assets/{name}.png" for name in (
        "inductor", "strippers", "discs", "skill-lance", "skill-anchor",
        "skill-gust", "npc-irma", "npc-sa7", "npc-lea")}
    if not visual_assets.issubset({p.relative_to(ROOT).as_posix() for p in files}):
        raise RuntimeError("New instrument, skill or NPC art is missing from the release")
    manifest = "".join(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(ROOT).as_posix()}\n" for p in files)
    DEST.mkdir(parents=True, exist_ok=True)
    archive = DEST / f"{PREFIX}.zip"
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=8) as z:
        for p in files:
            z.write(p, f"{PREFIX}/{p.relative_to(ROOT).as_posix()}")
        z.writestr(f"{PREFIX}/SHA256SUMS.txt", manifest)
    with zipfile.ZipFile(archive) as z:
        if z.testzip() is not None:
            raise RuntimeError("Release archive failed integrity check")
        names = set(z.namelist())
        if f"{PREFIX}/dist/Isobara.html" not in names:
            raise RuntimeError("Standalone HTML is missing from the archive")
        if any("/revisions/" in name for name in names):
            raise RuntimeError("Reference revisions leaked into the release")
    print(json.dumps({"archive": str(archive), "version": VERSION,
                      "files": len(files), "bytes": archive.stat().st_size}, ensure_ascii=False))


if __name__ == "__main__":
    main()
