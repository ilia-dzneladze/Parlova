export type DiffToken = { text: string; changed: boolean };

const TOKEN_RE = /[A-Za-zÄÖÜäöüß'']+|[^A-Za-zÄÖÜäöüß'']+/g;
const WORD_CHAR_RE = /[A-Za-zÄÖÜäöüß]/;

function tokenize(s: string): string[] {
    return s.match(TOKEN_RE) ?? [];
}

function isWord(t: string): boolean {
    return WORD_CHAR_RE.test(t);
}

/**
 * Word-level diff. Returns the `corrected` text as tokens, with `changed: true`
 * on word tokens that have no match in the original (case-insensitive LCS).
 * Whitespace and punctuation are never marked changed.
 */
export function diffCorrection(original: string, corrected: string): DiffToken[] {
    const a = tokenize(original);
    const b = tokenize(corrected);
    const eq = (x: string, y: string) => x.toLowerCase() === y.toLowerCase();

    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) {
        for (let j = n - 1; j >= 0; j--) {
            dp[i][j] = eq(a[i], b[j])
                ? dp[i + 1][j + 1] + 1
                : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }

    const out: DiffToken[] = [];
    let i = 0;
    let j = 0;
    while (i < m && j < n) {
        if (eq(a[i], b[j])) {
            out.push({ text: b[j], changed: false });
            i++; j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            i++;
        } else {
            out.push({ text: b[j], changed: isWord(b[j]) });
            j++;
        }
    }
    while (j < n) {
        out.push({ text: b[j], changed: isWord(b[j]) });
        j++;
    }
    return out;
}
