import fs from 'fs';
import path from 'path';

const dir = './src/components/ui';
const files = fs.readdirSync(dir);

for (const file of files) {
  if (file.endsWith('.tsx') || file.endsWith('.ts')) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/@\/lib\/utils/g, '@/src/lib/utils');
    content = content.replace(/@\/components\//g, '@/src/components/');
    fs.writeFileSync(filePath, content);
  }
}
console.log('Fixed imports');
