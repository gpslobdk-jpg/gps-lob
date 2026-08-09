from __future__ import annotations

import argparse
import html
import io
from collections import defaultdict
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph
from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph as PdfParagraph,
    Spacer,
    Table as PdfTable,
    TableStyle,
)


def iter_blocks(document: Document):
    body = document.element.body
    for child in body.iterchildren():
        if child.tag == qn("w:p"):
            yield Paragraph(child, document)
        elif child.tag == qn("w:tbl"):
            yield Table(child, document)


def alpha(number: int) -> str:
    value = ""
    while number:
        number, remainder = divmod(number - 1, 26)
        value = chr(97 + remainder) + value
    return value


def roman(number: int) -> str:
    values = (
        (1000, "m"),
        (900, "cm"),
        (500, "d"),
        (400, "cd"),
        (100, "c"),
        (90, "xc"),
        (50, "l"),
        (40, "xl"),
        (10, "x"),
        (9, "ix"),
        (5, "v"),
        (4, "iv"),
        (1, "i"),
    )
    output = ""
    for value, token in values:
        while number >= value:
            output += token
            number -= value
    return output


class Numbering:
    def __init__(self, document: Document):
        self.document = document
        self.counters: dict[int, dict[int, int]] = defaultdict(dict)
        root = document.part.numbering_part.element
        self.abstract_by_num: dict[int, object] = {}
        abstracts = {
            int(item.get(qn("w:abstractNumId"))): item
            for item in root.findall(qn("w:abstractNum"))
        }
        for num in root.findall(qn("w:num")):
            num_id = int(num.get(qn("w:numId")))
            abstract_id = int(num.find(qn("w:abstractNumId")).get(qn("w:val")))
            self.abstract_by_num[num_id] = abstracts[abstract_id]

    def _num_pr(self, paragraph: Paragraph):
        p_pr = paragraph._p.pPr
        if p_pr is not None and p_pr.numPr is not None:
            return p_pr.numPr
        style = paragraph.style
        visited: set[str] = set()
        while style is not None and style.style_id not in visited:
            visited.add(style.style_id)
            style_p_pr = style._element.pPr
            if style_p_pr is not None and style_p_pr.numPr is not None:
                return style_p_pr.numPr
            style = style.base_style
        return None

    def label(self, paragraph: Paragraph) -> str | None:
        num_pr = self._num_pr(paragraph)
        if num_pr is None or num_pr.numId is None:
            return None
        num_id = int(num_pr.numId.val)
        if num_id == 0 or num_id not in self.abstract_by_num:
            return None
        level = int(num_pr.ilvl.val) if num_pr.ilvl is not None else 0
        abstract = self.abstract_by_num[num_id]
        level_node = next(
            (item for item in abstract.findall(qn("w:lvl")) if int(item.get(qn("w:ilvl"))) == level),
            None,
        )
        if level_node is None:
            return None
        start_node = level_node.find(qn("w:start"))
        start = int(start_node.get(qn("w:val"))) if start_node is not None else 1
        current = self.counters[num_id].get(level, start - 1) + 1
        self.counters[num_id][level] = current
        for deeper in tuple(self.counters[num_id]):
            if deeper > level:
                del self.counters[num_id][deeper]

        text_node = level_node.find(qn("w:lvlText"))
        label = text_node.get(qn("w:val")) if text_node is not None else f"%{level + 1}."
        for index in range(1, 10):
            if f"%{index}" not in label:
                continue
            number = self.counters[num_id].get(index - 1, start)
            format_node = next(
                (
                    item.find(qn("w:numFmt"))
                    for item in abstract.findall(qn("w:lvl"))
                    if int(item.get(qn("w:ilvl"))) == index - 1
                ),
                None,
            )
            number_format = format_node.get(qn("w:val")) if format_node is not None else "decimal"
            rendered = (
                alpha(number)
                if number_format == "lowerLetter"
                else roman(number)
                if number_format == "lowerRoman"
                else str(number)
            )
            label = label.replace(f"%{index}", rendered)
        return label


def paragraph_markup(paragraph: Paragraph, prefix: str | None = None) -> str:
    chunks: list[str] = []
    if prefix:
        chunks.append(f"<b>{html.escape(prefix)}</b> ")
    for run in paragraph.runs:
        text = html.escape(run.text).replace("\t", " ").replace("\n", "<br/>")
        if not text:
            continue
        if run.bold:
            text = f"<b>{text}</b>"
        if run.italic:
            text = f"<i>{text}</i>"
        chunks.append(text)
    if not chunks and paragraph.text:
        chunks.append(html.escape(paragraph.text).replace("\t", " ").replace("\n", "<br/>"))
    return "".join(chunks)


def add_page(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(colors.HexColor("#0B6B57"))
    canvas.setLineWidth(1.2)
    canvas.line(18 * mm, height - 16 * mm, width - 18 * mm, height - 16 * mm)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(colors.HexColor("#075E4B"))
    canvas.drawString(18 * mm, height - 12 * mm, "SKOLEGPS.DK · STANDARD DATABEHANDLERAFTALE")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#4B5563"))
    canvas.drawRightString(width - 18 * mm, 11 * mm, f"Side {doc.page}")
    canvas.restoreState()


def render(source: Path, output: Path) -> None:
    document = Document(source)
    styles = getSampleStyleSheet()
    normal = ParagraphStyle(
        "DpaNormal",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=8.7,
        leading=12.2,
        alignment=TA_JUSTIFY,
        textColor=colors.HexColor("#17202A"),
        spaceAfter=3.5,
    )
    list_style = ParagraphStyle(
        "DpaList",
        parent=normal,
        leftIndent=7 * mm,
        firstLineIndent=-5 * mm,
    )
    heading = ParagraphStyle(
        "DpaHeading",
        parent=normal,
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=15,
        textColor=colors.HexColor("#075E4B"),
        spaceBefore=9,
        spaceAfter=6,
        keepWithNext=True,
        alignment=TA_LEFT,
    )
    title = ParagraphStyle(
        "DpaTitle",
        parent=heading,
        fontSize=21,
        leading=24,
        alignment=TA_CENTER,
        spaceBefore=8,
        spaceAfter=12,
    )
    notice = ParagraphStyle(
        "DpaNotice",
        parent=normal,
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#064E3B"),
        backColor=colors.HexColor("#E8F5F0"),
        borderColor=colors.HexColor("#85C7B8"),
        borderWidth=0.5,
        borderPadding=7,
        spaceAfter=12,
    )

    output.parent.mkdir(parents=True, exist_ok=True)
    buffer = io.BytesIO()
    doc = BaseDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=22 * mm,
        bottomMargin=18 * mm,
        title="Standarddatabehandleraftale – SkoleGPS",
        author="",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="body")
    doc.addPageTemplates(
        PageTemplate(id="all", frames=[frame], onPageEnd=add_page),
    )
    story = []
    numbering = Numbering(document)
    for block in iter_blocks(document):
        if isinstance(block, Paragraph):
            text = block.text.strip()
            if not text:
                story.append(Spacer(1, 2.2))
                continue
            label = numbering.label(block)
            style_name = block.style.name if block.style is not None else ""
            if text.startswith("STANDARD DATABEHANDLERAFTALE"):
                story.append(PdfParagraph(paragraph_markup(block), notice))
            elif style_name == "Title":
                story.append(PdfParagraph(paragraph_markup(block, label), title))
            elif style_name.startswith("Heading"):
                if text.startswith(("Bilag A", "Bilag B", "Bilag C", "Bilag D")) and story:
                    story.append(PageBreak())
                    if text.startswith("Bilag D"):
                        # ReportLab paints the final page's first flowable over
                        # the canvas header; reserve the header band explicitly.
                        story.append(Spacer(1, 16 * mm))
                story.append(PdfParagraph(paragraph_markup(block, label), heading))
            else:
                style = list_style if label else normal
                story.append(PdfParagraph(paragraph_markup(block, label), style))
        else:
            rows = []
            for row in block.rows:
                rows.append(
                    [
                        PdfParagraph(
                            "<br/>".join(html.escape(p.text) for p in cell.paragraphs if p.text),
                            ParagraphStyle(
                                "Cell",
                                parent=normal,
                                fontSize=6.7,
                                leading=8.5,
                                alignment=TA_LEFT,
                            ),
                        )
                        for cell in row.cells
                    ]
                )
            if rows:
                column_count = max(len(row) for row in rows)
                table = PdfTable(rows, colWidths=[doc.width / column_count] * column_count, repeatRows=1)
                table.setStyle(
                    TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#DDF2EC")),
                            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#064E3B")),
                            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                            ("VALIGN", (0, 0), (-1, -1), "TOP"),
                            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#9CA3AF")),
                            ("LEFTPADDING", (0, 0), (-1, -1), 4),
                            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                            ("TOPPADDING", (0, 0), (-1, -1), 4),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                        ]
                    )
                )
                story.append(KeepTogether([Spacer(1, 4), table, Spacer(1, 7)]))

    doc.build(story)

    reader = PdfReader(io.BytesIO(buffer.getvalue()))
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    writer.add_metadata(
        {
            "/Title": "Standarddatabehandleraftale – SkoleGPS",
            "/Subject": "Ikke underskrevet standardskabelon, version 1.2",
        }
    )
    with output.open("wb") as target:
        writer.write(target)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    render(args.source, args.output)
    print(args.output)


if __name__ == "__main__":
    main()
