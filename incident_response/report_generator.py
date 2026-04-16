import os
import asyncio
from datetime import datetime
from pathlib import Path
from loguru import logger

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_CENTER


SEVERITY_COLORS = {
    "CRITICAL": colors.HexColor("#DC143C"),
    "HIGH": colors.HexColor("#FF4500"),
    "MEDIUM": colors.HexColor("#FFA500"),
    "LOW": colors.HexColor("#32CD32"),
    "INFORMATIONAL": colors.HexColor("#4169E1")
}


class ReportGenerator:

    def __init__(self):
        self.output_dir = Path("reports")
        self.output_dir.mkdir(exist_ok=True)

        self.styles = getSampleStyleSheet()
        self.styles.add(ParagraphStyle(
            "SOCTitle", fontSize=20, spaceAfter=12,
            textColor=colors.HexColor("#1a1a2e"),
            fontName="Helvetica-Bold", alignment=TA_CENTER
        ))
        self.styles.add(ParagraphStyle(
            "SectionHeader", fontSize=13, spaceAfter=8,
            spaceBefore=12, fontName="Helvetica-Bold"
        ))

    async def generate(self, analysis: dict, original_alert: dict,
                       ioc_enrichments: list, thehive_case_id: str = None) -> str:
        # ReportLab is synchronous — push to thread pool
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None,
            lambda: self._generate_sync(analysis, original_alert, ioc_enrichments, thehive_case_id)
        )

    def _generate_sync(self, analysis, original_alert, ioc_enrichments, thehive_case_id):
        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filepath = self.output_dir / f"INCIDENT_{analysis['alert_id']}_{ts}.pdf"
        sev_color = SEVERITY_COLORS.get(analysis.get("severity", "MEDIUM"), colors.grey)

        doc = SimpleDocTemplate(
            str(filepath), pagesize=A4,
            rightMargin=2 * cm, leftMargin=2 * cm,
            topMargin=2.5 * cm, bottomMargin=2 * cm
        )

        # Build up the story list section by section
        story = []

        story.append(Paragraph("SECURITY INCIDENT REPORT", self.styles["SOCTitle"]))
        story.append(HRFlowable(width="100%", thickness=3, color=sev_color))
        story.append(Spacer(1, 0.3 * cm))

        header_data = [
            ["Incident ID:", analysis["alert_id"], "Severity:", analysis.get("severity", "N/A")],
            ["Decision:", analysis.get("decision", "N/A").upper(), "TheHive Case:", thehive_case_id or "N/A"],
            ["Analyzed By:", analysis.get("analyzed_by", "AI"), "Confidence:", f"{analysis.get('confidence', 0)}%"],
        ]
        t = Table(header_data, colWidths=[4 * cm, 6 * cm, 4 * cm, 5 * cm])
        t.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f0f4f8")]),
            ("PADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(t)
        story.append(Spacer(1, 0.4 * cm))

        story.append(Paragraph("Business Impact", self.styles["SectionHeader"]))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.lightgrey))
        story.append(Paragraph(analysis.get("business_impact", "N/A"), self.styles["Normal"]))
        story.append(Spacer(1, 0.3 * cm))

        story.append(Paragraph("Technical Analysis", self.styles["SectionHeader"]))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.lightgrey))
        story.append(Paragraph(analysis.get("investigation_notes", "N/A"), self.styles["Normal"]))
        story.append(Spacer(1, 0.3 * cm))

        story.append(Paragraph("MITRE ATT&CK", self.styles["SectionHeader"]))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.lightgrey))
        mitre = ", ".join(analysis.get("mitre_techniques", [])) or "N/A"
        story.append(Paragraph(
            f"Techniques: {mitre} | Phase: {analysis.get('attack_phase', 'Unknown')}",
            self.styles["Normal"]
        ))
        story.append(Spacer(1, 0.3 * cm))

        story.append(Paragraph("Recommended Containment", self.styles["SectionHeader"]))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.lightgrey))
        containment = analysis.get("recommended_containment", [])
        for i, action in enumerate(containment, 1):
            story.append(Paragraph(f"{i}. {action}", self.styles["Normal"]))
        story.append(Spacer(1, 0.5 * cm))

        generated_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
        story.append(HRFlowable(width="100%", thickness=2, color=sev_color))
        story.append(Paragraph(
            f"AI SOC Platform | {generated_at} | CONFIDENTIAL",
            ParagraphStyle("Footer", fontSize=8, textColor=colors.grey, alignment=TA_CENTER)
        ))

        doc.build(story)
        logger.info(f"[REPORT] Generated: {filepath}")
        return str(filepath)
