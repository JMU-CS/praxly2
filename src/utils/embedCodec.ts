import LZ from 'lz-string';

export interface EmbedData {
    code: string;
    lang: 'python' | 'java' | 'csp' | 'praxis';
}

/**
 * Encode code and language into a compressed URL-safe string
 * Uses LZ-string compression + base64 for minimal URL length
 */
export function encodeEmbed(data: EmbedData): string {
    const json = JSON.stringify(data);
    return LZ.compressToEncodedURIComponent(json);
}

/**
 * Decode a compressed embed string back to code and language
 * Returns null if decoding fails
 */
export function decodeEmbed(encoded: string): EmbedData | null {
    try {
        const json = LZ.decompressFromEncodedURIComponent(encoded);
        if (!json) return null;
        return JSON.parse(json) as EmbedData;
    } catch (e) {
        console.error('Failed to decode embed:', e);
        return null;
    }
}

/**
 * Generate a full embed iframe HTML string
 */
export function generateEmbedHTML(
    encoded: string,
    width: string = '100%',
    height: string = '600'
): string {
    const baseUrl = window.location.origin;
    const embedUrl = `${baseUrl}/v2/embed?code=${encoded}`;
    return `<iframe src="${embedUrl}" width="${width}" height="${height}" style="border: 1px solid #e5e7eb; border-radius: 0.5rem;" title="Praxly 2.0 Code Embed"></iframe>`;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {
        console.error('Failed to copy to clipboard:', e);
        return false;
    }
}

/**
 * Get compression stats (for debugging/info)
 */
export function getCompressionStats(original: string, compressed: string): {
    originalLength: number;
    compressedLength: number;
    ratio: string;
} {
    const originalLength = new Blob([original]).size;
    const compressedLength = new Blob([compressed]).size;
    return {
        originalLength,
        compressedLength,
        ratio: ((1 - compressedLength / originalLength) * 100).toFixed(1),
    };
}
