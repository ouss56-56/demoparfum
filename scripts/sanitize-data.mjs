import fs from 'fs';

const files = ['reconciled-products.json', 'reconciled-products-refined.json', 'db-state.json'];

files.forEach(file => {
    const path = `c:/Users/fares/Desktop/parfum store/${file}`;
    if (fs.existsSync(path)) {
        let content = fs.readFileSync(path, 'utf8');
        // Replace absolute local paths with null or relative placeholders
        const updated = content.replace(/C:\\\\Users\\\\fares\\\\Desktop\\\\LPS_Setif\\\\LPS IMAGE\\\\/g, '');
        fs.writeFileSync(path, updated);
        console.log(`Sanitized ${file}`);
    }
});
