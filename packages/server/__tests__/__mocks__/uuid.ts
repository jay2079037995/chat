let counter = 0;

export function v4(): string {
  counter += 1;
  return `mock-uuid-${counter}-${Date.now()}`;
}
