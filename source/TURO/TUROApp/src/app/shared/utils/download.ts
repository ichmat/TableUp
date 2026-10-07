/** Propose l'enregistrement d'un fichier reçu de l'API (export CSV) */
export function saveFile(blob: Blob, fileName: string, doc: Document = document): void {
    const url = URL.createObjectURL(blob);
    const link = doc.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
}
