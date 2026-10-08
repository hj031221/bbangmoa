const collator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' })

export function sortSavedBakeries(bakeries) {
  return [...bakeries].sort((a, b) =>
    collator.compare(a.name || '', b.name || '') ||
    collator.compare(a.breadType || '', b.breadType || '') ||
    collator.compare(String(a.id), String(b.id)),
  )
}
