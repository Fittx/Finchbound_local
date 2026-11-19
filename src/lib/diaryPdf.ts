// A compressed artwork layer preserves the diary fonts and photo crops. Each
// line also has a selectable Unicode text layer at its position on the sheet.
export type DiaryLine = { text: string; x: number; y: number; size: number; width: number };
export type DiarySheet = { jpeg: Blob; width: number; height: number; lines: DiaryLine[] };

function unicodeHex(value: string) {
  let result = "FEFF";
  for (let i = 0; i < value.length; i++)
    result += value.charCodeAt(i).toString(16).padStart(4, "0");
  return result;
}

export function diaryPdf(sheets: DiarySheet[]) {
  const parts: BlobPart[] = [];
  const offsets = [0];
  let length = 0;
  function write(part: string | Blob) {
    parts.push(part);
    // PDF syntax here is ASCII. All user text is encoded as hexadecimal.
    length += typeof part === "string" ? part.length : part.size;
  }
  function object(id: number, ...content: (string | Blob)[]) {
    offsets[id] = length;
    write(id + " 0 obj\n");
    content.forEach(write);
    write("\nendobj\n");
  }
  write("%PDF-1.7\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(
    2,
    `<< /Type /Pages /Count ${sheets.length} /Kids [${sheets.map((_, i) => 4 + i * 3 + " 0 R").join(" ")}] >>`,
  );
  object(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  sheets.forEach(({ jpeg, width, height, lines }, i) => {
    const id = 4 + i * 3;
    // A5 covers and A4 open spreads share the same physical height.
    const paperWidth = width < height ? 419.53 : 841.89;
    const paperHeight = 595.28;
    const scale = Math.min((paperWidth - 32) / width, (paperHeight - 32) / height);
    const left = (paperWidth - width * scale) / 2;
    const bottom = (paperHeight - height * scale) / 2;
    object(
      id,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${paperWidth} ${paperHeight}] /Resources << /Font << /F 3 0 R >> /XObject << /Art ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`,
    );
    object(
      id + 1,
      `<< /Type /XObject /Subtype /Image /Width ${width * 2} /Height ${height * 2} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.size} >>\nstream\n`,
      jpeg,
      "\nendstream",
    );
    let content = `q ${scale} 0 0 ${scale} ${left} ${bottom} cm\nq ${width} 0 0 ${height} 0 0 cm /Art Do Q\n`;
    for (const line of lines) {
      content += `/Span << /ActualText <${unicodeHex(line.text)}> >> BDC\nBT /F ${line.size} Tf 3 Tr ${(line.width / (line.size * 0.667)).toFixed(3)} 0 0 1 ${line.x} ${height - line.y} Tm (X) Tj ET\nEMC\n`;
    }
    content += "Q\n";
    object(id + 2, `<< /Length ${content.length} >>\nstream\n${content}endstream`);
  });
  const start = length;
  write(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  offsets.slice(1).forEach((offset) => write(String(offset).padStart(10, "0") + " 00000 n \n"));
  write(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`);
  return new Blob(parts, { type: "application/pdf" });
}
