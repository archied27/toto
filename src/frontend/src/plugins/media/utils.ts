import { useState, useEffect } from "react";

function rgbToHsl(r: number, g: number, b: number) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h: number, s: number, l: number) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

export function useDominantColor(imageUrl: string | undefined) {
    const [color, setColor] = useState<string | null>(null);

    useEffect(() => {
        if (!imageUrl) return;

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imageUrl;

        img.onload = () => {
            const canvas = document.createElement("canvas");
            const size = 32;
            canvas.width = size;
            canvas.height = size;

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            ctx.drawImage(img, 0, 0, size, size);

            try {
                const { data } = ctx.getImageData(0, 0, size, size);
                let r = 0, g = 0, b = 0, count = 0;

                for (let i = 0; i < data.length; i += 4) {
                    const alpha = data[i + 3];
                    if (alpha < 200) continue;

                    const pr = data[i], pg = data[i + 1], pb = data[i + 2];
                    const brightness = (pr + pg + pb) / 3;
                    if (brightness < 20 || brightness > 235) continue;

                    r += pr; g += pg; b += pb;
                    count++;
                }

                if (count === 0) {
                    setColor("rgb(120, 90, 160)");
                    return;
                }

                r = Math.round(r / count);
                g = Math.round(g / count);
                b = Math.round(b / count);

                // Boost saturation and lightness so the glow actually reads as color
                const hsl = rgbToHsl(r, g, b);
                const boosted = hslToRgb(
                    hsl.h,
                    Math.min(hsl.s * 1.6, 85),   // punch up saturation
                    Math.max(Math.min(hsl.l, 60), 45) // keep it mid-bright, not muddy dark or blown out
                );

                setColor(`rgb(${boosted.r}, ${boosted.g}, ${boosted.b})`);
            } catch {
                setColor(null);
            }
        };

        img.onerror = () => setColor(null);
    }, [imageUrl]);

    return color;
}

function getReleaseTypeDescription(releaseType: number, releaseDate?: string): string {
    if (releaseDate) {
        const release = new Date(releaseDate);
        const now = new Date();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        if (release > now) {
            return "Not Released";
        }

        if (release < sixMonthsAgo) {
            return "Released";
        }
    }

    switch (releaseType) {
        case 1: return "Premiered";
        case 2: return "Currently In Theaters";
        case 3: return "Currently In Theaters";
        case 4: return "Released";
        case 5: return "Released";
        case 6: return "Released";
        default: return "";
    }
}

export function isEpisodeAvailable(airDate: string | undefined): boolean {
    if (!airDate) return false;

    const air = new Date(airDate);
    const now = new Date();

    return air <= now;
}

export function formatDuration(seconds: number | undefined): string {
    if (!seconds) return "";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
}

export { getReleaseTypeDescription };