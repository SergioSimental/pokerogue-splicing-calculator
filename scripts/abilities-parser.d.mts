export function readAbilities(
  block: string,
  label: string,
  nameOf: (id: string) => string,
  warn?: (message: string) => void,
): { regular: string[]; hidden: string | null };
