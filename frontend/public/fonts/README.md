# Export fonts

Noto Sans Khmer Regular and Bold are distributed under the SIL Open Font License 1.1; see OFL.txt.

Source: https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf/NotoSansKhmer

The PDF exporter embeds these fonts, so readers do not need to install a font. For Excel, install Khmer OS on the computer opening the workbook if its spreadsheet application does not automatically substitute a Khmer-capable font.

pdfmake 0.3.11 bundles a fontkit null-anchor bug that crashes for Khmer text such as `រាំ`. `scripts/patch-pdfmake.mjs` applies a positioning guard during installation and before builds. It skips subtables with missing anchors while preserving glyphs and allowing subsequent positioning rules. The browser export tests cover all four reproduced Khmer combinations and verify embedded glyphs. Track the upstream fix at https://github.com/foliojs/fontkit/issues/367; review and remove the workaround when upgrading pdfmake.
