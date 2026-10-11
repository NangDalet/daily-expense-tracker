// Regenerate the shareable PDF from docs/USER_GUIDE.md using installed fonts.
// Run from the repository root: node frontend/scripts/build-user-guide.cjs
const fs = require('node:fs');
const path = require('node:path');
const pdfmake = require('pdfmake');
const root = path.resolve(__dirname, '../..');
const fontDir = path.join(path.dirname(require.resolve('pdfmake/package.json')), 'fonts/Roboto');
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy((file) => path.dirname(path.resolve(file)) === fontDir);
pdfmake.addFonts({ Roboto: {
  normal: path.join(fontDir, 'Roboto-Regular.ttf'),
  bold: path.join(fontDir, 'Roboto-Medium.ttf'),
  italics: path.join(fontDir, 'Roboto-Italic.ttf'),
  bolditalics: path.join(fontDir, 'Roboto-MediumItalic.ttf'),
} });

function inline(text) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).filter(Boolean).map((part) => {
    if (part.startsWith('**')) return { text: part.slice(2, -2), bold: true };
    if (part.startsWith('`')) return { text: part.slice(1, -1), color: '#4338ca' };
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return { text: link[1], link: link[2], color: '#4338ca', decoration: 'underline' };
    return { text: part };
  });
}

const lines = fs.readFileSync(path.join(root, 'docs/USER_GUIDE.md'), 'utf8').split(/\r?\n/);
const content = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  const heading = line.match(/^(#{1,3}) (.+)$/);
  if (heading) {
    const level = heading[1].length;
    content.push({ text: heading[2], style: `h${level}`, ...(level > 1 ? { headlineLevel: 1 } : {}) });
  } else if (line.startsWith('|')) {
    const rows = [];
    while (i < lines.length && lines[i].trim().startsWith('|')) {
      const cells = lines[i].trim().slice(1, -1).split('|').map(cell => cell.trim());
      if (!cells.every(cell => /^:?-+:?$/.test(cell))) rows.push(cells);
      i++;
    }
    i--;
    content.push({ unbreakable: true, table: { headerRows: 1, widths: [105, '*'], body: rows.map((row, index) => row.map(cell => ({ text: inline(cell), bold: index === 0, fillColor: index === 0 ? '#eef2ff' : null, margin: [4, 5] }))) }, layout: 'lightHorizontalLines', margin: [0, 5, 0, 12] });
  } else if (/^(\d+\. |- )/.test(line)) {
    const ordered = /^\d+\. /.test(line);
    const items = [];
    const pattern = ordered ? /^\d+\. / : /^- /;
    while (i < lines.length && pattern.test(lines[i].trim())) {
      items.push({ text: inline(lines[i].trim().replace(pattern, '')), margin: [0, 0, 0, 5] });
      i++;
    }
    i--;
    content.push({ [ordered ? 'ol' : 'ul']: items, unbreakable: true, margin: [0, 4, 0, 10] });
  } else {
    const paragraph = [line];
    while (i + 1 < lines.length && lines[i + 1].trim() && !/^(#|\||\d+\. |- )/.test(lines[i + 1].trim())) paragraph.push(lines[++i].trim());
    content.push({ text: inline(paragraph.join(' ')), margin: [0, 0, 0, 10] });
  }
}

// Keep each task heading with its first paragraph or complete step list.
for (let i = 0; i < content.length - 1; i++) {
  if (content[i].style === 'h3') {
    content.splice(i, 2, { stack: [content[i], content[i + 1]], unbreakable: true });
  }
}

const definition = {
  info: { title: 'Daily Expense Tracker — User Guide', author: 'Daily Expense Tracker', subject: 'How to use expenses, income, budgets, Telegram, monthly finances, and profiles' },
  pageSize: 'A4', pageMargins: [48, 54, 48, 52],
  defaultStyle: { font: 'Roboto', fontSize: 10.5, color: '#243247', lineHeight: 1.25 },
  styles: {
    h1: { fontSize: 25, bold: true, color: '#4338ca', margin: [0, 4, 0, 12] },
    h2: { fontSize: 16, bold: true, color: '#312e81', margin: [0, 16, 0, 9] },
    h3: { fontSize: 12, bold: true, color: '#0f172a', margin: [0, 10, 0, 6] },
  },
  header: { text: 'DAILY EXPENSE TRACKER  /  USER GUIDE', color: '#64748b', fontSize: 8, margin: [48, 22, 48, 0] },
  footer: (current, total) => ({ columns: [{ text: 'Updated October 10, 2026', alignment: 'left' }, { text: `${current} / ${total}`, alignment: 'right' }], color: '#64748b', fontSize: 8, margin: [48, 18, 48, 0] }),
  pageBreakBefore: (node, container) => node.headlineLevel === 1 && !container.getFollowingNodesOnPage().length,
  content,
};

pdfmake.createPdf(definition).write(path.join(root, 'docs/Daily-Expense-Tracker-User-Guide.pdf'))
  .then(() => console.log('Created docs/Daily-Expense-Tracker-User-Guide.pdf'))
  .catch((error) => { console.error(error.message); process.exitCode = 1; });
