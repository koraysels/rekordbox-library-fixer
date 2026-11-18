const Database = require('better-sqlite3-multiple-ciphers');
const key = require(process.argv[3]).key;
const db = new Database(process.argv[2], { readonly: true });
db.pragma("cipher='sqlcipher'"); db.pragma('legacy=4'); db.pragma(`key='${key}'`);
console.log(JSON.stringify(db.prepare("select count(*) n from djmdContent where FolderPath like '/spike/moved/%'").get()), db.pragma('integrity_check', {simple:true}));
