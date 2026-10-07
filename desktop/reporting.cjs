// Public submission address only. Never ship inbox/API credentials in the app.
function endpoint(value){if(!value)return '';const url=new URL(value);if(url.protocol!=='https:'||url.hostname!=='script.google.com'||url.port||url.username||url.password||url.search||url.hash||!/^\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(url.pathname))throw Error('Use the deployed Google Apps Script /exec endpoint.');return url.href;}
function clean(report){
 if(!report||report.format!=='family-gear-smoke-v1'||!/^\d+\.\d+\.\d+$/.test(report.version)||!['mouse','keyboard'].includes(report.type)||!Number.isInteger(report.vendorId)||!Number.isInteger(report.productId)||report.vendorId<0||report.vendorId>65535||report.productId<0||report.productId>65535||!Array.isArray(report.checks)||report.checks.length>24)throw Error('Invalid device report');
 const labels=['connection','settings-read','repeat-read','dpi-read','polling-read','lighting-read','trigger-read','battery-read','interfaces','physical-behavior'];
 const checks=report.checks.map(c=>{if(!labels.includes(c.name)||!['passed','failed','unavailable','not-tested'].includes(c.result))throw Error('Invalid smoke check');return {name:c.name,result:c.result};});
 const interfaces=Array.isArray(report.interfaces)?report.interfaces.slice(0,64).map(d=>{const row={};for(const key of ['vendorId','productId','interface','usagePage','usage'])if(Number.isInteger(d[key])&&d[key]>=-1&&d[key]<=65535)row[key]=d[key];return row;}):[];
 if(!/^[a-f0-9-]{36}$/.test(report.id))throw Error('Invalid report ID');
 return {id:report.id,format:report.format,version:report.version,type:report.type,vendorId:report.vendorId,productId:report.productId,checks,interfaces};
}
function createReporting(address,send=fetch){const url=endpoint(address);let sending=false,last=0;return {config:()=>({configured:Boolean(url),provider:'Google Forms',endpoint:url}),async submit(input){const report=clean(input);if(!url)return {sent:false,reason:'unconfigured'};if(sending||Date.now()-last<10000)return {sent:false,reason:'rate-limited'};sending=true;last=Date.now();try{let response=await send(url,{method:'POST',redirect:'manual',headers:{'Content-Type':'text/plain',Accept:'application/json'},body:JSON.stringify(report),signal:AbortSignal.timeout(10000)});
 // ContentService redirects to a one-time Google content URL. Do not forward
 // reports to arbitrary locations or Google sign-in pages.
 if(response.status===302||response.status===303){const target=new URL(response.headers.get('location'));if(target.protocol!=='https:'||target.hostname!=='script.googleusercontent.com'||target.username||target.password)throw Error('Unexpected report redirect');response=await send(target.href,{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000)});}
 if(!response.ok)return {sent:false,reason:'inbox-rejected'};const body=await response.json();return body.ok===true&&body.id===report.id?{sent:true}:{sent:false,reason:'inbox-not-confirmed'};}catch{return {sent:false,reason:'network-unavailable'};}finally{sending=false;}}};}
module.exports={endpoint,clean,createReporting};
