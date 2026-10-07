const fs=require('node:fs');const path=require('node:path');
function deviceKey(d){if(!Number.isInteger(d?.vendorId)||!Number.isInteger(d?.productId))return null;return JSON.stringify([d.vendorId,d.productId,String(d.serialNumber??''),String(d.productName??'')]);}
function createPermissions(directory){const file=path.join(directory,'selected-hid-devices.json');let keys=[];try{const data=JSON.parse(fs.readFileSync(file,'utf8'));if(Array.isArray(data))keys=data.filter(k=>typeof k==='string').slice(0,16);}catch{}
 return {allow(d){const key=deviceKey(d);return key!==null&&keys.includes(key);},remember(d){const key=deviceKey(d);if(!key)return;keys=[...keys.filter(k=>k!==key),key].slice(-16);fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(file,JSON.stringify(keys));}};}
module.exports={createPermissions,deviceKey};
