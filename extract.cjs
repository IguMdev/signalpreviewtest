const fs = require('fs');
const content = fs.readFileSync('index_dratania.html', 'utf-8');
const startTag = '<div class="elementor-element elementor-element-2697f09';
const idx = content.indexOf(startTag);
const nextTag = content.indexOf('<div class="elementor-element', idx + 100);
console.log(content.substring(idx, nextTag));
