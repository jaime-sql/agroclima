export function whatsAppLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function agronomistShareText(input: {
  summary: string;
  placeName: string;
  photoDate: string;
}): string {
  return `AgroClima: ${input.summary} Foto del ${input.photoDate}. Departamento: ${input.placeName}. Es una orientación, no un diagnóstico.`;
}

export function canShareFiles(
  canShare: ((data?: ShareData) => boolean) | undefined,
  file: File,
): boolean {
  if (!canShare) return false;
  try {
    return canShare({ files: [file] });
  } catch {
    return false;
  }
}
