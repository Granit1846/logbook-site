type LaunchRow = Record<string, unknown>;

const numericFields = ['vsu', 'zemlya', 'vozduh', 'tp', 'samolet',
  'zapravkaLiters', 'zapravkaDensity'] as const;

/** IDs and order belong to the journal, not to the launch contents. */
export function sameLaunchContents(a: LaunchRow, b: LaunchRow): boolean {
  return numericFields.every((field) => Number(a[field] ?? 0) === Number(b[field] ?? 0)) &&
    String(a.vedCek ?? '') === String(b.vedCek ?? '');
}
