"""
PDF Injection Service

Provides methods for injecting text into PDF documents with various
hiding techniques for security testing purposes.
"""
from __future__ import annotations
from io import BytesIO
from typing import Tuple, Optional, List

from pypdf import PdfReader, PdfWriter
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


class PDFInjectionService:
    """Service for injecting text into PDF documents."""

    # Color configurations for hiding text
    COLOR_WHITE = (1, 1, 1)           # Pure white
    COLOR_NEAR_WHITE = (0.95, 0.95, 0.95)  # Almost white
    COLOR_BLACK = (0, 0, 0)           # Normal black text

    # Font sizes
    SIZE_VISIBLE = 12
    SIZE_SMALL = 6
    SIZE_ZERO = 0.1                   # Near zero (reportlab doesn't allow 0)

    def __init__(self):
        """Initialize the PDF injection service."""
        self._register_fonts()

    def _register_fonts(self):
        """Register standard fonts for PDF generation."""
        # Using built-in fonts that don't require external files
        self.font_normal = "Helvetica"

    def inject_text(
        self,
        pdf_bytes: bytes,
        text: str,
        location: str = "end",
        visibility: str = "hidden_white"
    ) -> Tuple[bytes, dict]:
        """
        Inject text into a PDF document.

        Args:
            pdf_bytes: Original PDF document as bytes
            text: Text to inject
            location: Where to inject ('end', 'footer', 'header', 'metadata')
            visibility: How visible the text should be

        Returns:
            Tuple of (modified_pdf_bytes, injection_summary)
        """
        try:
            # Read the original PDF
            reader = PdfReader(BytesIO(pdf_bytes))
            writer = PdfWriter()

            # Copy all pages from original to writer
            for page in reader.pages:
                writer.add_page(page)

            summary = {
                "location": location,
                "visibility": visibility,
                "text_length": len(text),
                "pages_modified": 0
            }

            # Apply injection based on location
            if location == "metadata":
                self._inject_in_metadata(writer, text)
            elif location == "end":
                modified_pdf = self._inject_at_end(writer, text, visibility)
                return modified_pdf, {**summary, "pages_modified": 1}
            elif location == "footer":
                modified_pdf = self._inject_as_footer(writer, text, visibility)
                summary["pages_modified"] = len(reader.pages)
                return modified_pdf, summary
            elif location == "header":
                modified_pdf = self._inject_as_header(writer, text, visibility)
                summary["pages_modified"] = len(reader.pages)
                return modified_pdf, summary
            else:
                # Default to end injection
                modified_pdf = self._inject_at_end(writer, text, visibility)
                return modified_pdf, {**summary, "pages_modified": 1}

            # For metadata only, write directly
            output = BytesIO()
            writer.write(output)
            return output.getvalue(), summary

        except Exception as e:
            raise ValueError(f"PDF injection failed: {str(e)}")

    def _inject_in_metadata(self, writer: PdfWriter, text: str) -> None:
        """Inject text into PDF metadata fields."""
        # Split text across multiple metadata fields if needed
        metadata = {
            "/Title": text[:100] if len(text) > 100 else text,
            "/Subject": text[100:200] if len(text) > 200 else (text[100:] if len(text) > 100 else ""),
            "/Author": text[200:300] if len(text) > 300 else (text[200:] if len(text) > 200 else ""),
            "/Keywords": text[300:400] if len(text) > 400 else (text[300:] if len(text) > 300 else ""),
        }
        # Add metadata to the PDF
        writer.add_metadata(metadata)

    def _inject_at_end(
        self,
        writer: PdfWriter,
        text: str,
        visibility: str
    ) -> bytes:
        """Inject text as a new page at the end of the document."""
        # Create a new page with the injected text
        packet = BytesIO()
        c = canvas.Canvas(packet, pagesize=letter)

        # Apply visibility settings
        color, font_size = self._get_visibility_settings(visibility)

        c.setFillColorRGB(*color)
        c.setFont(self.font_normal, font_size)

        # Write text on the page
        # Position slightly off-center to avoid detection
        y_position = letter[1] - 100
        x_position = 72  # 1 inch from left

        # Split long text into lines
        lines = self._split_text(text, max_width=letter[0] - 144, font_size=font_size)
        for line in lines:
            if font_size < 1:
                # For hidden text, write at same position (overlay)
                c.drawString(x_position, y_position, line)
            else:
                c.drawString(x_position, y_position, line)
                y_position -= font_size + 2

        c.save()

        # Merge the new page with the original PDF
        new_page = PdfReader(packet).pages[0]
        writer.add_page(new_page)

        output = BytesIO()
        writer.write(output)
        return output.getvalue()

    def _inject_as_footer(
        self,
        writer: PdfWriter,
        text: str,
        visibility: str
    ) -> bytes:
        """Inject text as a footer on each page."""
        packet = BytesIO()

        color, font_size = self._get_visibility_settings(visibility)

        # We need to create an overlay for each page
        output = BytesIO()

        # Process each page
        for page_num in range(len(writer.pages)):
            page = writer.pages[page_num]

            # Create a watermark/overlay
            overlay_packet = BytesIO()
            c = canvas.Canvas(overlay_packet, pagesize=letter)

            c.setFillColorRGB(*color)
            c.setFont(self.font_normal, font_size)

            # Footer position (bottom of page)
            footer_y = 36  # 0.5 inch from bottom
            footer_x = 72  # 1 inch from left

            # Write the text
            c.drawString(footer_x, footer_y, text)

            c.save()

            # Merge the overlay with the page
            overlay = PdfReader(overlay_packet).pages[0]
            page.merge_page(overlay)

        writer.write(output)
        return output.getvalue()

    def _inject_as_header(
        self,
        writer: PdfWriter,
        text: str,
        visibility: str
    ) -> bytes:
        """Inject text as a header on each page."""
        color, font_size = self._get_visibility_settings(visibility)

        output = BytesIO()

        # Process each page
        for page_num in range(len(writer.pages)):
            page = writer.pages[page_num]

            # Create a watermark/overlay
            overlay_packet = BytesIO()
            c = canvas.Canvas(overlay_packet, pagesize=letter)

            c.setFillColorRGB(*color)
            c.setFont(self.font_normal, font_size)

            # Header position (top of page)
            header_y = letter[1] - 36  # 0.5 inch from top
            header_x = 72  # 1 inch from left

            # Write the text
            c.drawString(header_x, header_y, text)

            c.save()

            # Merge the overlay with the page
            overlay = PdfReader(overlay_packet).pages[0]
            page.merge_page(overlay)

        writer.write(output)
        return output.getvalue()

    def _get_visibility_settings(self, visibility: str) -> Tuple[Tuple[float, float, float], int]:
        """Get color and font size based on visibility setting."""
        settings = {
            "visible": (self.COLOR_BLACK, self.SIZE_VISIBLE),
            "hidden_white": (self.COLOR_WHITE, self.SIZE_VISIBLE),
            "hidden_small": (self.COLOR_WHITE, self.SIZE_SMALL),
            "hidden_zero": (self.COLOR_WHITE, self.SIZE_ZERO),
            "hidden_near_white": (self.COLOR_NEAR_WHITE, self.SIZE_SMALL),
        }
        return settings.get(visibility, settings["hidden_white"])

    def _split_text(self, text: str, max_width: float, font_size: int) -> list[str]:
        """Split text into lines that fit within the specified width."""
        if font_size < 1:
            # For hidden text, return as single chunks
            return [text[i:i+100] for i in range(0, len(text), 100)]

        # Approximate character width (Helvetica is roughly 0.6 * font_size)
        char_width = font_size * 0.5
        max_chars = int(max_width / char_width)

        lines = []
        current_line = ""

        for word in text.split():
            if len(current_line + word) < max_chars:
                current_line += (word + " ")
            else:
                if current_line:
                    lines.append(current_line.strip())
                current_line = word + " "

        if current_line:
            lines.append(current_line.strip())

        return lines if lines else [text]


# Singleton instance
pdf_injection_service = PDFInjectionService()
