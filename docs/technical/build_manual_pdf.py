#!/usr/bin/env python3
"""Build WURKUP_COMPLETE_TECHNICAL_MANUAL.pdf from the Markdown source.

Usage:
    python3 build_manual_pdf.py [source.md] [output.pdf]

Requires only reportlab (+ Pillow for image sizing, which reportlab already uses).
No pandoc, LaTeX, Chromium or network access is needed.

Features implemented here:
  * cover page with document metadata
  * clickable table of contents with real page numbers (reportlab multiBuild)
  * running header (document + current section) and footer (repo/branch, date, page number)
  * numbered figures and tables, with captions
  * page break before every numbered section and appendix
  * PDF outline bookmarks, so the sidebar navigation works too
"""
from __future__ import annotations

import math
import os
import re
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, CondPageBreak, Frame, Image, KeepTogether, NextPageTemplate,
    PageBreak, PageTemplate, Paragraph, Preformatted, Spacer, Table, TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

HERE = Path(__file__).resolve().parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "WURKUP_COMPLETE_TECHNICAL_MANUAL.md"
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else HERE / "WURKUP_COMPLETE_TECHNICAL_MANUAL.pdf"

PAGE_W, PAGE_H = A4
M_LEFT = M_RIGHT = 52
M_TOP = 74
M_BOTTOM = 58
CONTENT_W = PAGE_W - M_LEFT - M_RIGHT

NAVY = colors.HexColor("#16233A")
NAVY_SOFT = colors.HexColor("#2A3F5F")
ACCENT = colors.HexColor("#C8811C")
GREY = colors.HexColor("#5B6672")
LIGHT = colors.HexColor("#8A94A0")
RULE = colors.HexColor("#C9D2DC")
ZEBRA = colors.HexColor("#F5F7FA")
CODE_BG = colors.HexColor("#F2F4F7")

DOC_TITLE = "WURK UP"
DOC_SUBTITLE = "Complete Technical Manual"
DOC_VERSION = "Version 1.0"
DOC_DATE = "17 November 2026"
DOC_REPO = "sarthakjain5610/Shramset8.0"
DOC_BRANCH = "arena/ec593218-shramset8-0"


# --------------------------------------------------------------------------- fonts
def find_font_dir() -> Path | None:
    candidates = []
    try:
        import matplotlib  # noqa: WPS433
        candidates.append(Path(matplotlib.__file__).parent / "mpl-data" / "fonts" / "ttf")
    except Exception:
        pass
    candidates += [
        Path("/usr/share/fonts/truetype/dejavu"),
        Path("/usr/share/fonts/dejavu"),
        Path("/usr/local/share/fonts"),
        Path.home() / "Library/Fonts",
    ]
    for c in candidates:
        if (c / "DejaVuSans.ttf").exists():
            return c
    return None


def register_fonts():
    d = find_font_dir()
    if d is not None:
        pdfmetrics.registerFont(TTFont("Body", str(d / "DejaVuSans.ttf")))
        pdfmetrics.registerFont(TTFont("BodyBold", str(d / "DejaVuSans-Bold.ttf")))
        pdfmetrics.registerFont(TTFont("BodyItalic", str(d / "DejaVuSans-Oblique.ttf")))
        pdfmetrics.registerFont(TTFont("BodyBoldItalic", str(d / "DejaVuSans-BoldOblique.ttf")))
        pdfmetrics.registerFont(TTFont("Mono", str(d / "DejaVuSansMono.ttf")))
        pdfmetrics.registerFont(TTFont("MonoBold", str(d / "DejaVuSansMono-Bold.ttf")))
    else:  # fall back to the fonts shipped with reportlab (no ₹ / arrows, but valid PDF)
        base = Path(__file__).resolve().parent
        import reportlab
        base = Path(reportlab.__file__).parent / "fonts"
        pdfmetrics.registerFont(TTFont("Body", str(base / "Vera.ttf")))
        pdfmetrics.registerFont(TTFont("BodyBold", str(base / "VeraBd.ttf")))
        pdfmetrics.registerFont(TTFont("BodyItalic", str(base / "VeraIt.ttf")))
        pdfmetrics.registerFont(TTFont("BodyBoldItalic", str(base / "VeraBI.ttf")))
        pdfmetrics.registerFont(TTFont("Mono", str(base / "VeraMono.ttf")))
        pdfmetrics.registerFont(TTFont("MonoBold", str(base / "VeraMono-Bold.ttf")))
    pdfmetrics.registerFontFamily("Body", normal="Body", bold="BodyBold",
                                  italic="BodyItalic", boldItalic="BodyBoldItalic")
    pdfmetrics.registerFontFamily("Mono", normal="Mono", bold="MonoBold",
                                  italic="Mono", boldItalic="MonoBold")


# --------------------------------------------------------------------------- styles
def build_styles():
    s = {}
    s["body"] = ParagraphStyle(
        "body", fontName="Body", fontSize=9.3, leading=13.6, alignment=TA_LEFT,
        textColor=colors.HexColor("#1B2530"), spaceAfter=4.9,
    )
    s["h1"] = ParagraphStyle(
        "H1", fontName="BodyBold", fontSize=21, leading=25, textColor=NAVY,
        spaceBefore=0, spaceAfter=4,
    )
    s["h2"] = ParagraphStyle(
        "H2", fontName="BodyBold", fontSize=14.2, leading=17.4, textColor=NAVY,
        spaceBefore=2, spaceAfter=7, keepWithNext=1,
    )
    s["h3"] = ParagraphStyle(
        "H3", fontName="BodyBold", fontSize=10.9, leading=13.6, textColor=NAVY_SOFT,
        spaceBefore=10, spaceAfter=4.4, keepWithNext=1,
    )
    s["h4"] = ParagraphStyle(
        "H4", fontName="BodyBoldItalic", fontSize=9.7, leading=12.4, textColor=NAVY_SOFT,
        spaceBefore=8, spaceAfter=3.4, keepWithNext=1,
    )
    s["bullet"] = ParagraphStyle(
        "bullet", parent=s["body"], leftIndent=15, bulletIndent=4, spaceAfter=2.6,
        alignment=TA_LEFT,
    )
    s["quote"] = ParagraphStyle(
        "quote", parent=s["body"], fontSize=9.0, leading=13.0, textColor=colors.HexColor("#3A4551"),
        leftIndent=10, rightIndent=6, spaceBefore=2, spaceAfter=7, alignment=TA_LEFT,
    )
    s["code"] = ParagraphStyle(
        "code", fontName="Mono", fontSize=7.9, leading=10.6, textColor=colors.HexColor("#1B2530"),
    )
    s["caption"] = ParagraphStyle(
        "caption", fontName="BodyItalic", fontSize=8.4, leading=11.2, textColor=GREY,
        alignment=TA_LEFT, spaceBefore=3.4, spaceAfter=11,
    )
    s["tcaption"] = ParagraphStyle(
        "tcaption", fontName="BodyBold", fontSize=8.0, leading=10.6, textColor=GREY,
        spaceBefore=9, spaceAfter=3.2,
    )
    s["cell"] = ParagraphStyle(
        "cell", fontName="Body", fontSize=7.9, leading=10.4, textColor=colors.HexColor("#1B2530"),
        alignment=TA_LEFT,
    )
    s["cellhead"] = ParagraphStyle(
        "cellhead", fontName="BodyBold", fontSize=7.9, leading=10.4,
        textColor=colors.HexColor("#122033"), alignment=TA_LEFT,
    )
    s["h2plain"] = ParagraphStyle("H2plain", parent=s["h2"])
    s["toc0"] = ParagraphStyle(
        "toc0", fontName="BodyBold", fontSize=10.0, leading=19, textColor=NAVY,
        spaceBefore=3,
    )
    s["toc1"] = ParagraphStyle(
        "toc1", fontName="Body", fontSize=8.9, leading=13.4, textColor=colors.HexColor("#33414F"),
        leftIndent=16, firstLineIndent=0,
    )
    return s


# --------------------------------------------------------------------------- inline markdown
def esc(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def inline(text: str, mono: str = "8.6", code_color: str = "#123B5E") -> str:
    """Convert inline Markdown (code, bold, italic, links) to reportlab markup."""
    out = []
    for part in re.split(r"(`[^`]*`)", text):
        if len(part) >= 2 and part.startswith("`") and part.endswith("`"):
            out.append(
                '<font name="Mono" size="%s" color="%s">%s</font>'
                % (mono, code_color, esc(part[1:-1]))
            )
            continue
        s = esc(part)
        s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
        s = re.sub(r"(?<![\*\w])\*([^*\n]+?)\*(?!\*)", r"<i>\1</i>", s)
        s = re.sub(
            r"\[([^\]]+)\]\(([^)\s]+)\)",
            r'<link href="\2" color="#1F4E79">\1</link>',
            s,
        )
        out.append(s)
    return "".join(out)


# --------------------------------------------------------------------------- table helpers
def split_row(line: str):
    """Split a Markdown table row on pipes that are not inside backticks."""
    row = line.strip()
    if row.startswith("|"):
        row = row[1:]
    if row.endswith("|"):
        row = row[:-1]
    cells, buf, in_code = [], [], False
    for ch in row:
        if ch == "`":
            in_code = not in_code
            buf.append(ch)
        elif ch == "|" and not in_code:
            cells.append("".join(buf).strip())
            buf = []
        else:
            buf.append(ch)
    cells.append("".join(buf).strip())
    return cells


def is_separator(line: str) -> bool:
    cells = split_row(line)
    return bool(cells) and all(re.fullmatch(r":?-{2,}:?", c) for c in cells)


def col_widths(rows, expected, avail, font_size=7.9):
    """Column widths for a Markdown table.

    Content-heavy columns get more space (weight grows with the square root of the
    longest cell), but no column may fall below the width of its longest single word,
    so identifiers such as ``contractor_worker_assignments`` are not chopped.
    """
    cw = font_size * 0.62      # average glyph width of DejaVu Sans at this size
    cw_word = font_size * 0.78  # underscores and digits are wider than average
    pad = 15.0
    mins, weights = [], []
    for i in range(expected):
        cells = [r[i] for r in rows if i < len(r)]
        words = [len(w) for c in cells for w in re.split(r"\s+", c) if w]
        longest_word = max(words) if words else 4
        longest_cell = max((len(c) for c in cells), default=6)
        mins.append(min(longest_word * cw_word + pad, avail * 0.32))
        weights.append(math.sqrt(min(longest_cell, 400) + 3))

    total = sum(weights)
    raw = [avail * w / total for w in weights]
    for _ in range(6):  # water-filling: lift narrow columns to their minimum
        need = [max(0.0, mins[i] - raw[i]) for i in range(expected)]
        total_need = sum(need)
        if total_need < 0.5:
            break
        donors = [max(0.0, raw[i] - mins[i]) for i in range(expected)]
        total_don = sum(donors)
        if total_don <= 0.5:
            raw = list(mins)
            break
        take = min(total_need, total_don)
        raw = [raw[i] + need[i] - donors[i] * take / total_don for i in range(expected)]
    scale = avail / sum(raw)
    widths = [w * scale for w in raw]
    # the rescale above can dip under a minimum: restore minimums, taking the
    # difference from the widest columns so the row still sums to avail
    for _ in range(4):
        deficit = sum(max(0.0, mins[i] - widths[i]) for i in range(expected))
        if deficit < 0.5:
            break
        slack = [max(0.0, widths[i] - mins[i]) for i in range(expected)]
        total_slack = sum(slack)
        if total_slack < 0.5:
            break
        take = min(deficit, total_slack)
        widths = [widths[i] + max(0.0, mins[i] - widths[i]) - slack[i] * take / total_slack
                  for i in range(expected)]
    return widths


class ManualDoc(BaseDocTemplate):
    def __init__(self, out_path: str, styles, **kw):
        super().__init__(out_path, pagesize=A4, **kw)
        self.styles = styles
        self.current_section = ""
        self.table_no = 0
        self.figure_no = 0
        self.table_labels = []
        self.figure_labels = []
        self.page_sections = {}
        self.total_pages = 0
        frame_cover = Frame(0, 0, PAGE_W, PAGE_H, id="cover", leftPadding=0,
                            rightPadding=0, topPadding=0, bottomPadding=0)
        frame_body = Frame(M_LEFT, M_BOTTOM, CONTENT_W, PAGE_H - M_TOP - M_BOTTOM,
                           id="body", leftPadding=0, rightPadding=0,
                           topPadding=0, bottomPadding=0)
        self.addPageTemplates([
            PageTemplate(id="cover", frames=[frame_cover], onPage=self.draw_cover),
            PageTemplate(id="body", frames=[frame_body], onPageEnd=self.draw_body),
        ])

    # ---- page furniture -----------------------------------------------------
    def draw_cover(self, canv, doc):
        canv.saveState()
        band_h = 330
        canv.setFillColor(NAVY)
        canv.rect(0, PAGE_H - band_h, PAGE_W, band_h, stroke=0, fill=1)
        canv.setFillColor(ACCENT)
        canv.rect(0, PAGE_H - band_h - 5, PAGE_W, 5, stroke=0, fill=1)

        x = 52
        canv.setFillColor(colors.HexColor("#9FB0C6"))
        canv.setFont("BodyBold", 9.6)
        canv.drawString(x, PAGE_H - 96, "TECHNICAL MANUAL  ·  ENGINEERING AND OPERATIONS")

        canv.setFillColor(colors.white)
        canv.setFont("BodyBold", 40)
        canv.drawString(x, PAGE_H - 152, DOC_TITLE)
        canv.setFillColor(colors.HexColor("#D9E2EE"))
        canv.setFont("Body", 17)
        canv.drawString(x, PAGE_H - 180, DOC_SUBTITLE)

        canv.setStrokeColor(colors.HexColor("#3E5478"))
        canv.setLineWidth(0.8)
        canv.line(x, PAGE_H - 202, PAGE_W - 52, PAGE_H - 202)

        canv.setFillColor(colors.HexColor("#C6D2E2"))
        canv.setFont("Body", 10.2)
        canv.drawString(x, PAGE_H - 226,
                        "Verified digital work and wage records for India's informal construction workforce")
        canv.setFont("Body", 9.2)
        canv.setFillColor(colors.HexColor("#9FB0C6"))
        canv.drawString(x, PAGE_H - 248, "Supabase  ·  Cloudflare Workers  ·  React 19  ·  PostgreSQL 17")
        canv.drawString(x, PAGE_H - 266, "Senior Bal Vigyan Innovation  ·  Division II  ·  Indore, Madhya Pradesh")

        # metadata block
        y = PAGE_H - band_h - 46
        rows = [
            ("Document", "WURK UP Complete Technical Manual"),
            ("Version", DOC_VERSION),
            ("Date of record", DOC_DATE),
            ("Repository", DOC_REPO),
            ("Working branch", DOC_BRANCH + "  (base main @ d85ac8d)"),
            ("Supabase project", "qpgnoherjkvvasrwjcmf · ap-south-1 · PostgreSQL 17.11"),
            ("Production URL", "https://wurkup.sarthakjain5610.workers.dev"),
            ("Audience", "Engineers, operators, auditors and maintainers"),
        ]
        canv.setFont("Body", 9.0)
        for label, value in rows:
            canv.setFillColor(LIGHT)
            canv.drawString(52, y, label.upper())
            canv.setFillColor(colors.HexColor("#1B2530"))
            canv.drawString(168, y, value)
            y -= 19

        y -= 10
        canv.setStrokeColor(RULE)
        canv.setLineWidth(0.6)
        canv.line(52, y + 8, PAGE_W - 52, y + 8)
        canv.setFillColor(GREY)
        canv.setFont("Body", 8.4)
        canv.drawString(52, y - 14, "Status labels: Verified active · Configured but unverified · Disabled · "
                                     "Not configured · Prototype-demo only · Planned · Unknown")
        canv.drawString(52, y - 28, "This document contains no password, API key, JWT or SMTP credential.")
        canv.drawString(52, y - 42, "Prepared 17 November 2026 from repository code, live provider "
                                    "configuration and executed test runs.")
        canv.restoreState()

    def draw_body(self, canv, doc):
        canv.saveState()
        # header
        canv.setFillColor(NAVY)
        canv.setFont("BodyBold", 7.9)
        canv.drawString(M_LEFT, PAGE_H - 46, "WURK UP  ·  COMPLETE TECHNICAL MANUAL")
        canv.setFillColor(LIGHT)
        canv.setFont("Body", 7.4)
        canv.drawString(M_LEFT + 208, PAGE_H - 46, DOC_VERSION)
        canv.setFillColor(GREY)
        canv.setFont("Body", 7.9)
        section = self.section_for(doc.page)
        if len(section) > 54:
            section = section[:51].rstrip() + "…"
        canv.drawRightString(PAGE_W - M_RIGHT, PAGE_H - 46, section)
        canv.setStrokeColor(RULE)
        canv.setLineWidth(0.7)
        canv.line(M_LEFT, PAGE_H - 53, PAGE_W - M_RIGHT, PAGE_H - 53)
        # footer
        canv.line(M_LEFT, M_BOTTOM - 16, PAGE_W - M_RIGHT, M_BOTTOM - 16)
        canv.setFont("Body", 7.4)
        canv.setFillColor(LIGHT)
        canv.drawString(M_LEFT, M_BOTTOM - 29, DOC_REPO + "  ·  " + DOC_BRANCH)
        canv.drawRightString(PAGE_W - M_RIGHT - 92, M_BOTTOM - 29, DOC_DATE)
        canv.setFillColor(NAVY)
        canv.setFont("BodyBold", 7.9)
        if self.total_pages:
            canv.drawRightString(PAGE_W - M_RIGHT, M_BOTTOM - 29,
                                 "Page %d of %d" % (doc.page, self.total_pages))
        else:
            canv.drawRightString(PAGE_W - M_RIGHT, M_BOTTOM - 29, "Page %d" % doc.page)
        canv.restoreState()

    def section_for(self, page):
        return self.current_section or "Contents"

    def handle_documentBegin(self):
        self.current_section = "Contents"
        self.page_sections = {}
        self.table_no = 0
        self.figure_no = 0
        super().handle_documentBegin()

    # ---- TOC / outline ------------------------------------------------------
    def afterFlowable(self, flowable):
        if not isinstance(flowable, Paragraph):
            return
        name = flowable.style.name
        if name not in ("H2", "H3"):
            return
        text = flowable.getPlainText()
        level = 0 if name == "H2" else 1
        key = "sec-%d" % id(flowable)
        self.canv.bookmarkPage(key)
        self.canv.addOutlineEntry(text, key, level=level, closed=(level == 1))
        self.notify("TOCEntry", (level, text, self.page, key))
        if level == 0:
            self.current_section = text


# --------------------------------------------------------------------------- markdown parser
def parse_blocks(lines):
    blocks = []
    i, n = 0, len(lines)
    in_code = False
    code_buf = []
    para_buf = []
    quote_buf = []

    def flush_para():
        if para_buf:
            blocks.append(("p", " ".join(x.strip() for x in para_buf)))
            para_buf.clear()

    def flush_quote():
        if quote_buf:
            blocks.append(("quote", " ".join(x.strip() for x in quote_buf)))
            quote_buf.clear()

    while i < n:
        raw = lines[i]
        line = raw.rstrip("\n")

        if line.strip().startswith("```"):
            flush_para(); flush_quote()
            if in_code:
                blocks.append(("code", "\n".join(code_buf)))
                code_buf = []
                in_code = False
            else:
                in_code = True
            i += 1
            continue
        if in_code:
            code_buf.append(line)
            i += 1
            continue

        stripped = line.strip()
        if not stripped:
            flush_para(); flush_quote()
            i += 1
            continue

        if stripped == "---":
            flush_para(); flush_quote()
            blocks.append(("hr", ""))
            i += 1
            continue

        m = re.match(r"^(#{1,4})\s+(.*)$", stripped)
        if m:
            flush_para(); flush_quote()
            blocks.append(("h%d" % len(m.group(1)), m.group(2).strip()))
            i += 1
            continue

        m = re.match(r"^!\[(.*?)\]\((.*?)\)$", stripped)
        if m:
            flush_para(); flush_quote()
            blocks.append(("img", (m.group(1), m.group(2))))
            i += 1
            continue

        if stripped.startswith("|"):
            flush_para(); flush_quote()
            tbl = []
            while i < n and lines[i].strip().startswith("|"):
                tbl.append(lines[i].strip())
                i += 1
            blocks.append(("table", tbl))
            continue

        if stripped.startswith(">"):
            flush_para()
            quote_buf.append(stripped.lstrip(">").strip())
            i += 1
            continue

        m = re.match(r"^(\s*)([-*]|\d+\.)\s+(.*)$", line)
        if m:
            flush_para(); flush_quote()
            blocks.append(("li", (m.group(2), m.group(3).strip(), len(m.group(1)))))
            i += 1
            continue

        # an indented line after a list item is a continuation of that item
        if line[:1].isspace() and blocks and blocks[-1][0] == "li" and not para_buf:
            marker0, text0, indent0 = blocks[-1][1]
            blocks[-1] = ("li", (marker0, text0 + " " + stripped, indent0))
            i += 1
            continue

        flush_quote()
        para_buf.append(line)
        i += 1

    flush_para(); flush_quote()
    return blocks


def build_table(block_lines, styles, doc, section):
    header = split_row(block_lines[0])
    body = [split_row(r) for r in block_lines[1:] if not is_separator(r)]
    expected = len(header)
    if expected == 0:
        return Spacer(1, 1)
    norm = []
    for r in body:
        if len(r) < expected:
            r = r + [""] * (expected - len(r))
        norm.append(r[:expected])
    mono = "7.2" if expected >= 5 else "7.6"
    cell_style = ParagraphStyle("c%d" % expected, parent=styles["cell"],
                                fontSize=7.4 if expected >= 5 else 7.9,
                                leading=9.8 if expected >= 5 else 10.4)
    head_style = ParagraphStyle("ch%d" % expected, parent=styles["cellhead"],
                                fontSize=7.4 if expected >= 5 else 7.9,
                                leading=9.8 if expected >= 5 else 10.4)
    data = [[Paragraph(inline(c, mono), head_style) for c in header]]
    for r in norm:
        data.append([Paragraph(inline(c, mono), cell_style) for c in r])

    widths = col_widths([header] + norm, expected, CONTENT_W)
    t = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E7ECF3")),
        ("LINEBELOW", (0, 0), (-1, 0), 0.7, NAVY_SOFT),
        ("GRID", (0, 0), (-1, -1), 0.35, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4.2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4.2),
        ("TOPPADDING", (0, 0), (-1, -1), 3.2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.4),
    ]
    for idx in range(1, len(data)):
        if idx % 2 == 0:
            style.append(("BACKGROUND", (0, idx), (-1, idx), ZEBRA))
    t.setStyle(TableStyle(style))

    doc.table_no += 1
    label = "Table %d" % doc.table_no
    doc.table_labels.append(label)
    caption = Paragraph(label, styles["tcaption"])
    # Keep a table with its number when the pair fits a page. A table taller than the
    # frame must be allowed to split: wrapping it in KeepTogether pushes the whole block
    # to the next page and can leave the preceding page holding nothing but a heading.
    frame_h = PAGE_H - M_TOP - M_BOTTOM
    if estimate_height(t) + 22 < frame_h * 0.9:
        return [KeepTogether([caption, t]), Spacer(1, 7.5)]
    caption.keepWithNext = True
    return [caption, t, Spacer(1, 7.5)]


def callout(text, styles):
    """Render a Markdown blockquote as a light callout box with an accent bar."""
    para = Paragraph(inline(text), styles["quote"])
    box = Table([["", para]], colWidths=[4, CONTENT_W - 4], hAlign="LEFT")
    box.setStyle(TableStyle([
        ("BACKGROUND", (1, 0), (1, 0), colors.HexColor("#F4F6F9")),
        ("BACKGROUND", (0, 0), (0, 0), ACCENT),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (1, 0), (1, 0), 9),
        ("RIGHTPADDING", (1, 0), (1, 0), 9),
    ]))
    return KeepTogether([Spacer(1, 4), box, Spacer(1, 10)])


def build_image(alt, path, styles, doc):
    p = (SRC.parent / path).resolve()
    if not p.exists():
        return [Paragraph("[missing figure: %s]" % esc(path), styles["caption"])]
    from PIL import Image as PILImage  # provided with reportlab
    with PILImage.open(p) as im:
        iw, ih = im.size
    w = CONTENT_W
    h = w * ih / iw
    max_h = PAGE_H - M_TOP - M_BOTTOM - 96
    if h > max_h:
        h = max_h
        w = h * iw / ih
    doc.figure_no += 1
    img = Image(str(p), width=w, height=h)
    img.hAlign = "CENTER"
    caption = alt or "Figure %d" % doc.figure_no
    m = re.match(r"Figure (\d+)\s*·\s*(.*)$", caption)
    if m:
        number, rest = m.group(1), m.group(2).strip()
        if " — " in rest:
            title, sub = rest.split(" — ", 1)
            caption = "<b>Figure %s</b> &nbsp;%s.<br/><i>%s</i>" % (
                number, esc(title.strip()), esc(sub.strip()))
        else:
            caption = "<b>Figure %s</b> &nbsp;%s." % (number, esc(rest))
    doc.figure_labels.append("Figure %d" % doc.figure_no)
    cap = Paragraph(caption, styles["caption"])
    return [Spacer(1, 4), KeepTogether([img, cap])]


HEADING_STYLES = ("H2", "H3", "H4")


def estimate_height(flowable, avail_w=CONTENT_W, avail_h=None):
    """Approximate stacked height of a flowable (KeepTogether has no usable wrap())."""
    avail_h = avail_h or PAGE_H
    content = getattr(flowable, "_content", None)
    if content:
        total = 0.0
        for child in content:
            total += estimate_height(child, avail_w, avail_h)
        return total
    try:
        _, h = flowable.wrap(avail_w, avail_h)
        return h
    except Exception:
        return avail_h


COMMIT_HEADING_SPACE = 300  # points a heading must have under it before a tall table


def fix_orphan_headings(story):
    """Keep a heading together with its own text, or with the block that follows it.

    Three rules, all aimed at the same defect (a heading stranded at the foot of a page):
      * heading + its introductory paragraphs travel together, and the table or figure
        that follows may start on the next page;
      * a heading with no text before a small enough figure/table is merged with that block;
      * a heading with no text before a block too tall to merge gets a conditional page
        break in front of it, so heading and table still start the next page together.
    """
    frame_h = PAGE_H - M_TOP - M_BOTTOM
    out = []
    i = 0
    while i < len(story):
        item = story[i]
        if isinstance(item, Paragraph) and item.style.name in HEADING_STYLES:
            j = i + 1
            group = [item]
            while j < len(story) and isinstance(story[j], Spacer):
                group.append(story[j])
                j += 1
            paras = []
            while j < len(story) and isinstance(story[j], Paragraph) and story[j].style.name == "body":
                paras.append(story[j])
                j += 1
                group.append(paras[-1])
            if paras:
                out.append(KeepTogether(group))
                i = j
                continue
            target = story[j] if j < len(story) else None
            if isinstance(target, (KeepTogether, Table)):
                inner = getattr(target, "_content", None)
                content = list(inner) if inner else [target]
                height = sum(estimate_height(x) for x in group + content)
                if height < frame_h * 0.95:
                    out.append(KeepTogether(group + content))
                    i = j + 1
                    continue
                # too tall to keep the whole block on one page: rather than leave the
                # heading alone at the bottom, start it on a page with room underneath
                out.append(CondPageBreak(min(frame_h * 0.55, COMMIT_HEADING_SPACE)))
                out.append(KeepTogether(group))
                i = j
                continue
        out.append(item)
        i += 1
    return out


def compose(doc, styles, blocks):
    """Build a fresh flowable list (flowables cannot be reused across builds)."""
    doc.current_section_hint = ""
    story = [NextPageTemplate("body"), Spacer(1, 1), PageBreak()]
    toc = TableOfContents()
    toc.levelStyles = [styles["toc0"], styles["toc1"]]
    toc.dotsMinLevel = 0
    story += [
        Paragraph("Contents", ParagraphStyle("TOCHead", parent=styles["h1"],
                                            fontSize=18, spaceAfter=2)),
        Spacer(1, 10), toc, PageBreak(),
    ]

    # the front-matter notes (status-label legend, secrets policy) are typeset right
    # after the contents page, so the reader meets them before the first section
    front_quotes = []
    for kind, payload in blocks:
        if kind == "h2":
            break
        if kind == "quote":
            front_quotes.append(payload)
    if front_quotes:
        story.append(Spacer(1, 6))
        story.append(Paragraph("How to read this manual", styles["h2plain"]))
        story.append(Spacer(1, 2.5))
        for quote in front_quotes:
            story.append(callout(quote, styles))
        story.append(CondPageBreak((PAGE_H - M_TOP - M_BOTTOM) * 0.5))

    first_section = True
    for kind, payload in blocks:
        if kind == "h1":
            continue
        if kind == "h2":
            if not first_section:
                # start a section on a fresh page, unless the current page is nearly
                # empty already (which would leave a page with two stray lines on it)
                story.append(CondPageBreak((PAGE_H - M_TOP - M_BOTTOM) * 0.62))
            first_section = False
            doc.current_section_hint = payload
            story.append(Paragraph(inline(payload), styles["h2"]))
            story.append(Spacer(1, 2.5))
            continue
        if kind == "h3":
            story.append(Paragraph(inline(payload), styles["h3"]))
            continue
        if kind == "h4":
            story.append(Paragraph(inline(payload), styles["h4"]))
            continue
        if kind == "hr":
            continue
        if kind == "p":
            if first_section:
                continue  # title, tagline and metadata block live on the cover
            story.append(Paragraph(inline(payload), styles["body"]))
            continue
        if kind == "quote":
            if first_section:
                continue  # already typeset under the contents
            story.append(callout(payload, styles))
            continue
        if kind == "li":
            marker, text, indent = payload
            bullet = "•" if marker in ("-", "*") else marker
            style = styles["bullet"]
            if indent >= 2:
                style = ParagraphStyle("bullet2", parent=style, leftIndent=30, bulletIndent=19)
            story.append(KeepTogether([Paragraph(inline(text), style, bulletText=bullet)]))
            continue
        if kind == "code":
            box = Table([[Preformatted(payload, styles["code"])]], colWidths=[CONTENT_W],
                        hAlign="LEFT")
            box.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), CODE_BG),
                ("BOX", (0, 0), (-1, -1), 0.4, RULE),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]))
            story += [Spacer(1, 2), box, Spacer(1, 8)]
            continue
        if kind == "table":
            header = split_row(payload[0])
            if not any(c.strip() for c in header):
                continue  # unlabelled front-matter block, already on the cover
            story += build_table(payload, styles, doc, doc.current_section_hint)
            continue
        if kind == "img":
            alt, path = payload
            story += build_image(alt, path, styles, doc)
            continue
    return fix_orphan_headings(story)


def new_doc():
    return ManualDoc(str(OUT), build_styles(), title="WURK UP — Complete Technical Manual",
                     author="WURK UP engineering",
                     subject="Engineering and operations manual for the WURK UP deployment",
                     creator="build_manual_pdf.py")


def main():
    register_fonts()
    styles = build_styles()
    md_text = SRC.read_text(encoding="utf-8")

    lines = md_text.splitlines()
    try:  # the hand-written Markdown TOC is replaced by the generated one
        start = next(i for i, l in enumerate(lines) if l.strip() == "## Table of contents")
        end = next(i for i, l in enumerate(lines) if l.startswith("**Appendices:**"))
        lines = lines[:start] + lines[end + 1:]
    except StopIteration:
        pass
    blocks = parse_blocks(lines)

    first = new_doc()
    first.multiBuild(compose(first, styles, blocks))
    total = first.page

    # second build: identical story, now that the total page count is known
    doc = new_doc()
    doc.total_pages = total
    doc.multiBuild(compose(doc, styles, blocks))
    print("wrote %s" % OUT)
    print("pages: %d, figures: %d, tables: %d"
          % (doc.page, len(doc.figure_labels), len(doc.table_labels)))


if __name__ == "__main__":
    main()
