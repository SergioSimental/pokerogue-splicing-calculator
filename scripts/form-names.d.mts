export function resolveFormKey(raw: string | null | undefined): string | null;
export function formTemplateKey(formKey: string): string | null;
export function formName(
  speciesName: string,
  rawFormKey: string | null | undefined,
  templates: Record<string, unknown>,
  label: string,
  warn?: (message: string) => void,
): string;
