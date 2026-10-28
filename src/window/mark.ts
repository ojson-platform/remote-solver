/** Factory silhouette shared by the header and the page icon. Straight cuts and 45° only. */
export const FACTORY_PATH =
  'M9 0 L11 2 L9 4 L7 2 Z' +
  'M12 2 L14 4 L12 6 L10 4 Z' +
  'M21 0 L23 2 L21 4 L19 2 Z' +
  'M24 1 L26 3 L24 5 L22 3 Z' +
  'M8 8 h4 v8 H8 Z' +
  'M20 5 h4 v11 h-4 Z' +
  'M4 16 H12 L16 20 H20 V16 H28 V22 H4 Z' +
  'M4 24 H28 V31 H4 Z' +
  'M6 26 h4 v3 H6 Z' +
  'M12 26 h4 v3 h-4 Z' +
  'M18 26 h4 v3 h-4 Z';

export function factorySvg(color: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<path fill="${color}" fill-rule="evenodd" d="${FACTORY_PATH}"/>` +
    `</svg>`
  );
}
