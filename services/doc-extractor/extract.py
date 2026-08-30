#!/usr/bin/env python3
"""Extract PDF text and emit one JSON object on stdout."""
import json
import sys

try:
    from pypdf import PdfReader
except ImportError as exc:
    print(json.dumps({"error": f"pypdf is required: {exc}"}))
    raise SystemExit(1)

if len(sys.argv) != 2:
    raise SystemExit("usage: extract.py FILE")

reader = PdfReader(sys.argv[1])
text = "\n\n".join((page.extract_text() or "") for page in reader.pages).strip()
print(json.dumps({"text": text, "pageCount": len(reader.pages)}))
