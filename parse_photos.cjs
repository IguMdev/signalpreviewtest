const fs = require('fs');
const content = fs.readFileSync('index_dynamic.html', 'utf-8');

const regex = /<img[^>]+class="ti-reviewer-avatar"[^>]+src="([^"]+)"[^>]*>/g;
let match;
while ((match = regex.exec(content)) !== null) {
    console.log(match[1]);
}
