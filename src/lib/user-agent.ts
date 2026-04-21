// src/lib/user-agent.ts
export interface ParsedUA {
  browser: string
  os: string
}

export function parseUserAgent(ua: string | null | undefined): ParsedUA {
  if (!ua || ua.length < 4) return { browser: "Sconosciuto", os: "Sconosciuto" }

  let os = "Sconosciuto"
  if (/iPhone|iPad|iPod/.test(ua)) os = "iOS"
  else if (/Android/.test(ua)) os = "Android"
  else if (/Macintosh|Mac OS X/.test(ua)) os = "macOS"
  else if (/Windows/.test(ua)) os = "Windows"
  else if (/Linux/.test(ua)) os = "Linux"

  let browser = "Sconosciuto"
  if (/Firefox\//.test(ua)) browser = "Firefox"
  else if (/Edg\//.test(ua)) browser = "Edge"
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = "Chrome"
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = "Safari"

  return { browser, os }
}
