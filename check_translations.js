const fs = require('fs');
try {
    const fr = JSON.parse(fs.readFileSync('messages/fr.json', 'utf8'));
    console.log("fr.json admin keys:");
    console.log(JSON.stringify(fr.admin, null, 2));
} catch(e) { console.error("fr:", e.message) }
try {
    const en = JSON.parse(fs.readFileSync('messages/en.json', 'utf8'));
    console.log("\nen.json admin keys:");
    console.log(JSON.stringify(en.admin, null, 2));
} catch(e) { console.error("en:", e.message) }
