import { jsPDF } from 'jspdf'
import type { DocumentBlock, NutritionDocument } from '../domain/documents'

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN = 18
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const CONTENT_BOTTOM = 276

function rgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '176fa5'
  return [Number.parseInt(normalized.slice(0, 2), 16), Number.parseInt(normalized.slice(2, 4), 16), Number.parseInt(normalized.slice(4, 6), 16)]
}

export function buildNutritionPdf(document: NutritionDocument): jsPDF {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  const primary = rgb(document.branding.primaryColor)
  let y = 41

  const drawHeader = () => {
    pdf.setFillColor(...primary); pdf.rect(0, 0, PAGE_WIDTH, 5, 'F')
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13); pdf.setTextColor(24, 52, 70)
    pdf.text(document.branding.clinicName || 'AtriaNutri', MARGIN, 17)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(93, 113, 126)
    const header = document.branding.headerText.trim()
    if (header) pdf.text(header, PAGE_WIDTH - MARGIN, 17, { align: 'right', maxWidth: 85 })
    pdf.setDrawColor(221, 230, 235); pdf.line(MARGIN, 24, PAGE_WIDTH - MARGIN, 24)
  }
  const nextPage = () => { pdf.addPage(); drawHeader(); y = 34 }
  const ensure = (height: number) => { if (y + height > CONTENT_BOTTOM) nextPage() }
  const lines = (text: string, width = CONTENT_WIDTH) => pdf.splitTextToSize(text || 'Não informado', width) as string[]
  const paragraph = (text: string, color: [number, number, number] = [65, 86, 100]) => {
    const wrapped = lines(text)
    for (let index = 0; index < wrapped.length; index += 1) {
      ensure(5)
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...color)
      pdf.text(wrapped[index], MARGIN, y); y += 4.4
    }
    y += 2
  }
  const sectionTitle = (title: string) => {
    ensure(12); y += 2
    pdf.setFillColor(240, 247, 250); pdf.roundedRect(MARGIN, y - 5, CONTENT_WIDTH, 9, 2, 2, 'F')
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9.5); pdf.setTextColor(...primary); pdf.text(title, MARGIN + 4, y + 1)
    y += 8
  }

  drawHeader()
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(20); pdf.setTextColor(22, 52, 72)
  for (const line of lines(document.title, CONTENT_WIDTH)) { pdf.text(line, MARGIN, y); y += 8 }
  y += 1
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(91, 112, 125)
  pdf.text(`Paciente: ${document.patientName}`, MARGIN, y)
  pdf.text(`${document.branding.professionalName} · ${document.branding.crn}`, PAGE_WIDTH - MARGIN, y, { align: 'right' })
  y += 8
  if (document.introduction) paragraph(document.introduction)

  const renderFields = (block: Extract<DocumentBlock, { kind: 'fields' }>) => {
    sectionTitle(block.title)
    for (const field of block.fields) {
      const valueLines = lines(field.value, CONTENT_WIDTH - 48)
      ensure(7)
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.8); pdf.setTextColor(119, 136, 147); pdf.text(field.label, MARGIN, y)
      for (let index = 0; index < valueLines.length; index += 1) {
        if (y + 4.2 > CONTENT_BOTTOM) { nextPage(); sectionTitle(`${block.title} — continuação`); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.8); pdf.setTextColor(119, 136, 147); pdf.text(`${field.label} — continuação`, MARGIN, y) }
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.8); pdf.setTextColor(56, 79, 94); pdf.text(valueLines[index], MARGIN + 48, y)
        y += 4.2
      }
      y += 2
      pdf.setDrawColor(237, 241, 244); pdf.line(MARGIN, y - 2, PAGE_WIDTH - MARGIN, y - 2)
    }
    y += 2
  }

  const renderTable = (block: Extract<DocumentBlock, { kind: 'table' }>) => {
    sectionTitle(block.title)
    const count = block.columns.length
    const widths = Array.from({ length: count }, (_, index) => count === 2 ? (index === 0 ? CONTENT_WIDTH * .56 : CONTENT_WIDTH * .44) : index === count - 1 ? CONTENT_WIDTH * .34 : CONTENT_WIDTH * .66 / (count - 1))
    const drawHead = () => {
      ensure(8); pdf.setFillColor(247, 249, 250); pdf.rect(MARGIN, y - 4, CONTENT_WIDTH, 7, 'F')
      let x = MARGIN + 2
      block.columns.forEach((column, index) => { pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(95, 116, 129); pdf.text(column, x, y); x += widths[index] })
      y += 6
    }
    drawHead()
    for (const row of block.rows) {
      const wrapped = row.map((cell, index) => lines(cell, widths[index] - 4))
      const longest = Math.max(...wrapped.map((cell) => cell.length)); let offset = 0
      while (offset < longest) {
        let available = Math.floor((CONTENT_BOTTOM - y - 3) / 3.8)
        if (available < 1) { nextPage(); sectionTitle(`${block.title} — continuação`); drawHead(); available = Math.floor((CONTENT_BOTTOM - y - 3) / 3.8) }
        const count = Math.min(longest - offset, available)
        let x = MARGIN + 2
        wrapped.forEach((cell, index) => { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.6); pdf.setTextColor(56, 79, 94); const chunk = cell.slice(offset, offset + count); if (chunk.length) pdf.text(chunk, x, y); x += widths[index] })
        y += Math.max(7, count * 3.8 + 3); offset += count
        pdf.setDrawColor(232, 238, 241); pdf.line(MARGIN, y - 2, PAGE_WIDTH - MARGIN, y - 2)
        if (offset < longest) { nextPage(); sectionTitle(`${block.title} — continuação`); drawHead() }
      }
    }
    y += 3
  }

  const renderChart = (block: Extract<DocumentBlock, { kind: 'chart' }>) => {
    sectionTitle(block.title)
    if (block.assessments.length < 2) { paragraph('São necessárias ao menos duas avaliações para desenhar o gráfico.'); return }
    ensure(72)
    const box = { x: MARGIN + 7, y: y + 5, w: CONTENT_WIDTH - 14, h: 48 }
    const values = block.assessments.flatMap((item) => [item.weightKg, ...(item.waistCm === undefined ? [] : [item.waistCm])])
    const min = Math.min(...values) - 2; const max = Math.max(...values) + 2; const range = Math.max(1, max - min)
    pdf.setDrawColor(215, 224, 229); pdf.rect(box.x, box.y, box.w, box.h)
    for (let index = 1; index < 4; index += 1) { const lineY = box.y + box.h * index / 4; pdf.setDrawColor(235, 240, 243); pdf.line(box.x, lineY, box.x + box.w, lineY) }
    const x = (index: number) => box.x + (block.assessments.length === 1 ? 0 : box.w * index / (block.assessments.length - 1))
    const pointY = (value: number) => box.y + box.h - (value - min) / range * box.h
    const drawSeries = (valuesForSeries: (number | undefined)[], color: [number, number, number]) => {
      pdf.setDrawColor(...color); pdf.setFillColor(...color); pdf.setLineWidth(.7)
      let previous: { x: number; y: number } | null = null
      valuesForSeries.forEach((value, index) => { if (value === undefined) return; const current = { x: x(index), y: pointY(value) }; if (previous) pdf.line(previous.x, previous.y, current.x, current.y); pdf.circle(current.x, current.y, 1.2, 'F'); previous = current })
    }
    drawSeries(block.assessments.map((item) => item.weightKg), primary)
    drawSeries(block.assessments.map((item) => item.waistCm), [62, 153, 143])
    pdf.setFontSize(7); pdf.setTextColor(...primary); pdf.text('Peso (kg)', box.x, box.y + box.h + 7)
    pdf.setTextColor(62, 153, 143); pdf.text('Cintura (cm)', box.x + 23, box.y + box.h + 7)
    pdf.setTextColor(113, 130, 140); pdf.text(`Período: ${block.assessments[0].assessedAt.slice(0, 10)} a ${block.assessments.at(-1)!.assessedAt.slice(0, 10)}`, box.x + box.w, box.y + box.h + 7, { align: 'right' })
    y += 66
  }

  for (const block of document.blocks) {
    if (block.kind === 'fields') renderFields(block)
    else if (block.kind === 'paragraphs') { sectionTitle(block.title); block.paragraphs.forEach((item) => paragraph(item)) }
    else if (block.kind === 'table') renderTable(block)
    else renderChart(block)
  }
  if (document.closingNotes) { sectionTitle('Observações finais'); paragraph(document.closingNotes) }

  const pages = pdf.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page); pdf.setDrawColor(221, 230, 235); pdf.line(MARGIN, 282, PAGE_WIDTH - MARGIN, 282)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(111, 128, 139)
    pdf.text(document.branding.footerText || 'Documento gerado localmente pelo AtriaNutri.', MARGIN, 287, { maxWidth: 100 })
    pdf.text(`${document.branding.professionalName} · ${document.branding.crn}`, PAGE_WIDTH / 2, 287, { align: 'center', maxWidth: 65 })
    pdf.text(`Página ${page} de ${pages}`, PAGE_WIDTH - MARGIN, 287, { align: 'right' })
  }
  return pdf
}

export function nutritionPdfBlob(document: NutritionDocument): Blob {
  return buildNutritionPdf(document).output('blob')
}

export function downloadNutritionPdf(document: NutritionDocument) {
  buildNutritionPdf(document).save(document.fileName)
}
