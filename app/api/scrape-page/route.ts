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
  const patterns = [
    /\b\d{3,11}\b/g,
    /\b\d{1,3}[.,]?\d{3}[.,]?\d{3,4}\b/g,
  ]

  const potentialElements = $(
    '[id*="identificacion"], [class*="identificacion"], [id*="cedula"], [class*="cedula"], [id*="documento"], [class*="documento"], b, strong, span, p, div',
  )

  for (const element of potentialElements.toArray()) {
    const text = $(element).text().trim()
    for (const pattern of patterns) {
      const matches = text.match(pattern)
      if (matches && matches.length > 0) {
        const cleanNumber = matches[0].replace(/[^\d]/g, "")
        if (cleanNumber.length >= 3 && cleanNumber.length <= 11) {
          console.log(`Identificación encontrada en elemento: ${cleanNumber}`)
          return cleanNumber
        }
      }
    }
  }

  const textContent = $.text()
  for (const pattern of patterns) {
    const matches = textContent.match(pattern)
    if (matches && matches.length > 0) {
      const cleanNumber = matches[0].replace(/[^\d]/g, "")
      if (cleanNumber.length >= 3 && cleanNumber.length <= 11) {
        console.log(`Identificación encontrada en texto plano: ${cleanNumber}`)
        return cleanNumber
      }
    }
  }

  return null
}
