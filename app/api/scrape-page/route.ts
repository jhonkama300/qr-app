import { type NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio" // Importar cheerio para un mejor scraping

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const url = searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "URL es requerida" }, { status: 400 })
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const html = await response.text()

    // Usar Cheerio para un parsing más robusto
    const $ = cheerio.load(html)

    // Buscar números de identificación en el HTML
    const identificacion = extractIdentificationFromHTML(html, $)

    return NextResponse.json({
      identificacion,
      success: true,
    })
  } catch (error) {
    console.error("Error al hacer scraping:", error)
    return NextResponse.json({ error: "Error al acceder a la página" }, { status: 500 })
  }
}

function extractIdentificationFromHTML(html: string, $: cheerio.CheerioAPI): string | null {
  const fullText = $.text()

  // Priority 1: Buscar "C.C." seguido de número (patrón más confiable)
  const ccPattern = /C\.?\s*C\.?\s*[:\s]*(\d{3,11})\b/g
  const ccMatch = ccPattern.exec(fullText)
  if (ccMatch) {
    const id = ccMatch[1].replace(/[^\d]/g, "")
    if (id.length >= 5 && id.length <= 11) {
      console.log(`Identificación encontrada por patrón C.C.: ${id}`)
      return id
    }
  }

  // Priority 2: Buscar "identificado con" seguido de tipo de doc y número
  const identificadoPattern = /identificado con\s+\w+\.?\s*(\d{3,11})\b/i
  const idMatch = identificadoPattern.exec(fullText)
  if (idMatch) {
    const id = idMatch[1].replace(/[^\d]/g, "")
    if (id.length >= 5 && id.length <= 11) {
      console.log(`Identificación encontrada por patrón 'identificado con': ${id}`)
      return id
    }
  }

  // Priority 3: Buscar en elementos con id/class específico (identificacion, cedula, documento)
  const specificElements = $(
    '[id*="identificacion"], [class*="identificacion"], [id*="cedula"], [class*="cedula"], [id*="documento"], [class*="documento"]',
  )

  for (const element of specificElements.toArray()) {
    const text = $(element).text().trim()
    const numbers = text.match(/\b\d{5,11}\b/g)
    if (numbers && numbers.length > 0) {
      const cleanNumber = numbers[0].replace(/[^\d]/g, "")
      if (cleanNumber.length >= 5 && cleanNumber.length <= 11) {
        console.log(`Identificación encontrada en elemento específico: ${cleanNumber}`)
        return cleanNumber
      }
    }
  }

  // Priority 4: Escanear todo el texto plano, filtrando años y priorizando números largos
  const allNumbers = [...fullText.matchAll(/\b(\d{3,11})\b/g)]
    .map((m) => m[1])
    .filter((n) => {
      if (n.length === 4 && n.startsWith("20") && Number.parseInt(n) >= 2020 && Number.parseInt(n) <= 2099) return false
      return n.length >= 5
    })
    .sort((a, b) => b.length - a.length || a.localeCompare(b))

  if (allNumbers.length > 0) {
    const cleanNumber = allNumbers[0].replace(/[^\d]/g, "")
    if (cleanNumber.length >= 5 && cleanNumber.length <= 11) {
      console.log(`Identificación encontrada en texto plano: ${cleanNumber}`)
      return cleanNumber
    }
  }

  return null
}
