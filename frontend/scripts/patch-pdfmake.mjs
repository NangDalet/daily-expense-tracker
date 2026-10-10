import { readFile, writeFile } from 'node:fs/promises'

// fontkit treats legal NULL GPOS anchors as objects. Skip that positioning
// subtable so later subtables can still attach the mark; keep all glyphs.
// https://github.com/foliojs/fontkit/issues/367
// Remove this workaround when pdfmake ships the upstream fontkit fix.
const bundle = new URL('../node_modules/pdfmake/build/pdfmake.js', import.meta.url)
const source = await readFile(bundle, 'utf8')
const marker = '/* expense-tracker: skip missing GPOS anchor */'
const calls = /this\.applyAnchor\(markRecord, baseAnchor, (baseGlyphIndex|prevIndex)\);/g
const count = [...source.matchAll(calls)].length
if (count !== 3) throw new Error('pdfmake font layout changed; review the null-anchor workaround before building.')
if (!source.includes(marker)) {
  const patched = source.replace(calls, (call) =>
    `${marker}\n                    if (!baseAnchor || !markRecord.markAnchor) return false;\n                    ${call}`)
  await writeFile(bundle, patched)
  console.log('Applied pdfmake null-anchor fix for Khmer PDF exports.')
}
