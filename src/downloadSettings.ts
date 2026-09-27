// Chrome downloads only accepts paths relative to the browser's Downloads directory.
export function isValidFolder(value: string): boolean {
  return value.length > 0 && value.split('/').every((part) =>
    part !== '.' && part !== '..' && part.trim() === part &&
    part.length > 0 && !/[<>:"\\|?*\u0000-\u001F]/.test(part) && !/\.$/.test(part))
}
