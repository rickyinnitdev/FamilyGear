// Paste into a new Apps Script project. Run setup once, then deploy a web app
// executing as yourself with access Anyone. Never share your edit links/tokens.
function setup() {
  var properties = PropertiesService.getScriptProperties();
  if (properties.getProperty('FORM_ID')) { console.log(FormApp.openById(properties.getProperty('FORM_ID')).getEditUrl()); return; }
  var form = FormApp.create('Family Gear device reports');
  form.setDescription('Automatic read-only device smoke checks. Physical behavior is not inferred from these checks.');
  form.setCollectEmail(false);
  var item = form.addParagraphTextItem().setTitle('Device smoke report').setRequired(true);
  properties.setProperties({FORM_ID:form.getId(),ITEM_ID:String(item.getId())});
  console.log('Private inbox: '+form.getEditUrl());
}
function doGet() { return output({ready:Boolean(PropertiesService.getScriptProperties().getProperty('FORM_ID'))}); }
function output(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    if (!e || !e.postData || e.postData.contents.length > 16000) return output({ok:false});
    var r = JSON.parse(e.postData.contents);
    if (!r || r.format !== 'family-gear-smoke-v1' || !/^[a-f0-9-]{36}$/.test(r.id) || !/^\d+\.\d+\.\d+$/.test(r.version) || ['mouse','keyboard'].indexOf(r.type) < 0 || !Number.isInteger(r.vendorId) || !Number.isInteger(r.productId) || r.vendorId<0 || r.vendorId>65535 || r.productId<0 || r.productId>65535 || !Array.isArray(r.checks) || r.checks.length>24) return output({ok:false});
    var names=['connection','settings-read','repeat-read','dpi-read','polling-read','lighting-read','trigger-read','battery-read','interfaces','physical-behavior'];
    var checks=r.checks.map(function(c){if(names.indexOf(c.name)<0 || ['passed','failed','unavailable','not-tested'].indexOf(c.result)<0)throw Error('Invalid check');return {name:c.name,result:c.result};});
    var interfaces=(Array.isArray(r.interfaces)?r.interfaces:[]).slice(0,64).map(function(d){var row={};['vendorId','productId','interface','usagePage','usage'].forEach(function(k){if(Number.isInteger(d[k])&&d[k]>=-1&&d[k]<=65535)row[k]=d[k];});return row;});
    lock.waitLock(5000);
    var cache=CacheService.getScriptCache();
    if(cache.get(r.id))return output({ok:true,id:r.id});
    var props=PropertiesService.getScriptProperties(),day=new Date().toISOString().slice(0,10),count=Number(props.getProperty('COUNT_'+day)||0);
    if(count>=100)return output({ok:false});
    var form=FormApp.openById(props.getProperty('FORM_ID')),item=form.getItemById(Number(props.getProperty('ITEM_ID'))).asParagraphTextItem();
    var report={format:r.format,id:r.id,version:r.version,type:r.type,vendorId:r.vendorId,productId:r.productId,checks:checks,interfaces:interfaces};
    form.createResponse().withItemResponse(item.createResponse(JSON.stringify(report,null,2))).submit();
    cache.put(r.id,'received',21600);props.setProperty('COUNT_'+day,String(count+1));
    return output({ok:true,id:r.id});
  } catch(error) { return output({ok:false}); }
  finally { if(lock.hasLock())lock.releaseLock(); }
}
