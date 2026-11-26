export function humanizeToken(value: string): string {
    const spaced = value.replace(/[_-]+/g, " ").trim();
    if (spaced.length === 0) {
        return value;
    }
    return `${spaced.slice(0, 1).toLocaleUpperCase()}${spaced.slice(1)}`;
}
