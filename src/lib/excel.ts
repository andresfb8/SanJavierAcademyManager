import ExcelJS from 'exceljs'

/**
 * Downloads an array of objects as an .xlsx file using ExcelJS.
 * Safe replacement for xlsx/SheetJS.
 */
export async function downloadXlsx(
    rows: Record<string, unknown>[],
    sheetName: string,
    fileName: string
): Promise<void> {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(sheetName)

    if (rows.length === 0) {
        const buf = await wb.xlsx.writeBuffer()
        triggerDownload(buf, fileName)
        return
    }

    // Header row
    const headers = Object.keys(rows[0])
    ws.addRow(headers)

    // Data rows
    for (const row of rows) {
        ws.addRow(headers.map((h) => row[h] ?? ''))
    }

    const buf = await wb.xlsx.writeBuffer()
    triggerDownload(buf, fileName)
}

/**
 * Downloads an array-of-arrays as an .xlsx file using ExcelJS.
 */
export async function downloadXlsxAoa(
    aoa: unknown[][],
    sheetName: string,
    fileName: string
): Promise<void> {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(sheetName)
    for (const row of aoa) {
        ws.addRow(row as ExcelJS.CellValue[])
    }
    const buf = await wb.xlsx.writeBuffer()
    triggerDownload(buf, fileName)
}

function triggerDownload(buffer: ExcelJS.Buffer, fileName: string): void {
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

/**
 * Parses an Excel serial date number to a YYYY-MM-DD string.
 * Replaces XLSX.SSF.parse_date_code without relying on xlsx.
 */
export function parseExcelSerialDate(serial: number): string {
    // Excel's epoch is December 30, 1899
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000))
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, '0')
    const d = String(date.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}
