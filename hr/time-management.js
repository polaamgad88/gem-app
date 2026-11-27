/* GEM HR time & leave management: frontend-only, fictional records. */
(() => {
"use strict";
const V=[
["leaves","إدارة الإجازات","Leave Administration","calendar-check"],
["adjustments","حركات تعديل الأرصدة","Balance Adjustments","sliders"],
["carryover","إدارة أرصدة الإجازات المرحلة","Carried-forward Balances","wallet"],
["logs","سجل حركات الدوام","Attendance Log","clock"],
["imports","سجل حركات الحضور المستوردة","Imported Attendance Logs","file-import"],
["shifts","ورديات عمل الموظفين","Employee Work Shifts","calendar-days"],
["locations","المواقع الجغرافية للموظفين","Employee Work Locations","location-dot"],
["transactions","إدارة حركات الدوام","Attendance Transactions","fingerprint"],
["missing","طلبات حركات الدوام غير المسجلة","Missing Punch Requests","triangle-exclamation"],
["suggestions","الحركات المقترحة","Suggested Transactions","wand-magic-sparkles"]
];
const key=document.body.dataset.view||"leaves";
const meta=V.find(x=>x[0]===key)||V[0];
let lang=localStorage.getItem("gem_hr_lang")==="en"?"en":"ar",query="",state="all",branch="all",page=1,formMode="";
const $=q=>document.querySelector(q);
const t=(a,e)=>lang==="ar"?a:e;
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const icon=n=>'<i class="fa-solid fa-'+n+'" aria-hidden="true"></i>';
const persons=[
{id:"001",ar:"أحمد محمد",en:"Ahmed Mohamed",b:"hq",job:"IT"},
{id:"002",ar:"سارة علي",en:"Sara Ali",b:"hq",job:"HR"},
{id:"014",ar:"كريم ناجح",en:"Karim Nageh",b:"factory",job:"Production"},
{id:"016",ar:"يوسف خالد",en:"Youssef Khaled",b:"factory",job:"Warehouse"},
{id:"020",ar:"منى أحمد",en:"Mona Ahmed",b:"alex",job:"Finance"},
{id:"022",ar:"محمد حسن",en:"Mohamed Hassan",b:"factory",job:"Operations"},
{id:"025",ar:"مريم عادل",en:"Mariam Adel",b:"alex",job:"Quality"},
{id:"030",ar:"عمر خالد",en:"Omar Khaled",b:"hq",job:"Sales"}
];
const pname=x=>{const p=persons.find(a=>a.id===String(x));return p?(lang==="ar"?p.ar:p.en):x};
const bname=x=>({hq:t("المقر الرئيسي","Head Office"),factory:t("مصنع القاهرة","Cairo Factory"),alex:t("فرع الإسكندرية","Alexandria Branch")})[x]||x;
const title=x=>lang==="ar"?x[1]:x[2];
const date=d=>d?new Intl.DateTimeFormat(lang==="ar"?"ar-EG":"en-GB",{day:"2-digit",month:"short",year:"numeric",numberingSystem:"latn"}).format(new Date(d+"T12:00:00")):"—";
const base={
leaves:[
{id:101,person:"014",type:"annual",from:"2026-12-02",to:"2026-12-04",days:3,status:"pending",reason:"Family"},
{id:102,person:"001",type:"sick",from:"2026-11-18",to:"2026-11-18",days:1,status:"approved",reason:"Medical"},
{id:103,person:"020",type:"annual",from:"2026-11-15",to:"2026-11-19",days:5,status:"approved",reason:"Travel"},
{id:104,person:"002",type:"casual",from:"2026-11-21",to:"2026-11-21",days:1,status:"rejected",reason:"Personal"},
{id:105,person:"030",type:"annual",from:"2026-12-08",to:"2026-12-10",days:3,status:"pending",reason:"Family"}],
adjustments:[
{id:201,person:"001",type:"annual",days:2,status:"approved",date:"2026-11-08",reason:"Opening reconciliation"},
{id:202,person:"014",type:"casual",days:-1,status:"pending",date:"2026-11-13",reason:"Balance correction"},
{id:203,person:"020",type:"annual",days:3,status:"approved",date:"2026-11-15",reason:"HR adjustment"}],
carryover:[
{id:301,person:"001",type:"annual",days:5,status:"active",date:"2026-01-01",reason:"2025 → 2026"},
{id:302,person:"002",type:"annual",days:4,status:"active",date:"2026-01-01",reason:"2025 → 2026"},
{id:303,person:"014",type:"annual",days:2,status:"expired",date:"2026-01-01",reason:"2025 → 2026"}],
logs:[
{id:401,person:"001",date:"2026-11-23",in:"08:58",out:"17:07",hours:"08:09",status:"present",source:"ZKTeco"},
{id:402,person:"014",date:"2026-11-23",in:"09:17",out:"17:01",hours:"07:44",status:"late",source:"ZKTeco"},
{id:403,person:"016",date:"2026-11-23",in:"07:03",out:"15:12",hours:"08:09",status:"present",source:"ZKTeco"},
{id:404,person:"002",date:"2026-11-22",in:"09:01",out:"—",hours:"—",status:"missing",source:"ZKTeco"},
{id:405,person:"020",date:"2026-11-22",in:"08:59",out:"17:12",hours:"08:13",status:"present",source:"Excel"}],
imports:[
{id:501,file:"Attendance_Example_Sheet_01.xlsx",date:"2026-11-23",total:120,accepted:116,rejected:4,status:"partial",source:"ZKTeco / Excel"},
{id:502,file:"Attendance_Example_Sheet_02.xlsx",date:"2026-11-20",total:92,accepted:92,rejected:0,status:"complete",source:"Excel"},
{id:503,file:"Cairo_Gate_Export.csv",date:"2026-11-19",total:82,accepted:80,rejected:2,status:"partial",source:"ZKTeco"},
{id:504,file:"Alex_Branch_Export.csv",date:"2026-11-18",total:50,accepted:50,rejected:0,status:"complete",source:"Excel"}],
shifts:[
{id:601,person:"014",date:"2026-11-29",type:"A",in:"07:00",out:"15:00",status:"assigned"},
{id:602,person:"016",date:"2026-11-29",type:"B",in:"15:00",out:"23:00",status:"assigned"},
{id:603,person:"001",date:"2026-11-29",type:"office",in:"09:00",out:"17:00",status:"assigned"},
{id:604,person:"022",date:"2026-11-30",type:"C",in:"23:00",out:"07:00",status:"assigned"},
{id:605,person:"020",date:"2026-11-30",type:"office",in:"09:00",out:"17:00",status:"assigned"}],
locations:[
{id:701,person:"001",location:"Cairo HQ",branch:"hq",status:"active",radius:"150 m"},
{id:702,person:"014",location:"Factory Gate 1",branch:"factory",status:"active",radius:"100 m"},
{id:703,person:"016",location:"Factory Warehouse",branch:"factory",status:"active",radius:"200 m"},
{id:704,person:"020",location:"Alexandria Office",branch:"alex",status:"active",radius:"120 m"}],
transactions:[
{id:801,person:"014",date:"2026-11-23",in:"09:17",out:"17:01",status:"late",source:"ZKTeco"},
{id:802,person:"002",date:"2026-11-22",in:"09:01",out:"—",status:"missing",source:"ZKTeco"},
{id:803,person:"001",date:"2026-11-23",in:"08:58",out:"17:07",status:"present",source:"ZKTeco"}],
missing:[
{id:901,person:"002",date:"2026-11-22",type:"out",status:"pending",reason:"Forgot checkout"},
{id:902,person:"020",date:"2026-11-20",type:"in",status:"approved",reason:"Device unavailable"},
{id:903,person:"014",date:"2026-11-19",type:"out",status:"pending",reason:"Gate scanner offline"}],
suggestions:[
{id:1001,person:"002",date:"2026-11-22",type:"out",status:"pending",reason:"Suggested check-out based on shift"},
{id:1002,person:"014",date:"2026-11-23",type:"late",status:"pending",reason:"Unmatched late punch"}]
};
function read(){try{return JSON.parse(localStorage.getItem("gem_hr_time_demo_v1"))||{}}catch{return {}}}
let stored=read();
function rows(){return [...(base[key]||[]),...(stored[key]||[])].map(x=>({...x}))}
function persist(item){stored[key]||=[];stored[key].unshift(item);localStorage.setItem("gem_hr_time_demo_v1",JSON.stringify(stored))}
function chip(v){let labels={
pending:[t("قيد المراجعة","Pending"),"warn"],approved:[t("تمت الموافقة","Approved"),"good"],rejected:[t("مرفوض","Rejected"),"bad"],active:[t("نشط","Active"),"good"],expired:[t("منتهي","Expired"),"bad"],present:[t("منتظم","Present"),"good"],late:[t("متأخر","Late"),"warn"],missing:[t("حركة ناقصة","Missing punch"),"bad"],partial:[t("جزئي","Partial"),"warn"],complete:[t("مكتمل","Complete"),"good"],assigned:[t("مجدول","Scheduled"),"good"]};
const [label,c]=labels[v]||[esc(v),""];return '<span class="tm-chip '+c+'">'+label+'</span>'}
function lv(x){return {annual:t("إجازة سنوية","Annual leave"),sick:t("إجازة مرضية","Sick leave"),casual:t("إجازة عارضة","Casual leave"),out:t("انصراف","Clock-out"),in:t("حضور","Clock-in"),late:t("تأخير","Late arrival"),office:t("دوام مكتبي","Office shift"),A:"A",B:"B",C:"C"}[x]||esc(x)}
function fields(){switch(key){
case"leaves":return [["person",t("الموظف","Employee")],["type",t("نوع الإجازة","Leave type")],["from",t("من","From")],["to",t("إلى","To")],["days",t("الأيام","Days")],["status",t("الحالة","Status")]];
case"adjustments":return [["person",t("الموظف","Employee")],["type",t("نوع الرصيد","Balance type")],["days",t("التعديل (أيام)","Adjustment (days)")],["date",t("التاريخ","Date")],["reason",t("السبب","Reason")],["status",t("الحالة","Status")]];
case"carryover":return [["person",t("الموظف","Employee")],["type",t("نوع الإجازة","Leave type")],["days",t("الأيام المرحلة","Carried days")],["reason",t("السنة","Year")],["status",t("الحالة","Status")]];
case"logs":return [["person",t("الموظف","Employee")],["date",t("التاريخ","Date")],["in",t("أول تسجيل","First punch")],["out",t("آخر تسجيل","Last punch")],["hours",t("ساعات العمل","Hours")],["status",t("الحالة","Status")],["source",t("المصدر","Source")]];
case"imports":return [["file",t("اسم الملف","Filename")],["date",t("تاريخ الاستيراد","Import date")],["total",t("إجمالي السجلات","Total")],["accepted",t("مقبول","Accepted")],["rejected",t("مرفوض","Rejected")],["status",t("الحالة","Status")]];
case"shifts":return [["person",t("الموظف","Employee")],["date",t("التاريخ","Date")],["type",t("الوردية","Shift")],["in",t("البداية","Start")],["out",t("النهاية","End")],["status",t("الحالة","Status")]];
case"locations":return [["person",t("الموظف","Employee")],["location",t("الموقع","Location")],["branch",t("الفرع","Branch")],["radius",t("نطاق العمل","Radius")],["status",t("الحالة","Status")]];
case"transactions":return [["person",t("الموظف","Employee")],["date",t("التاريخ","Date")],["in",t("الحضور","Clock in")],["out",t("الانصراف","Clock out")],["source",t("المصدر","Source")],["status",t("الحالة","Status")]];
case"missing":case"suggestions":return [["person",t("الموظف","Employee")],["date",t("التاريخ","Date")],["type",t("نوع الحركة","Movement type")],["reason",t("السبب","Reason")],["status",t("الحالة","Status")]];
default:return[]}}
function value(row,k){let v=row[k];if(k==="person")return esc(pname(v));if(k==="branch")return esc(bname(v));if(k==="type")return lv(v);if(k==="status")return chip(v);if(["from","to","date"].includes(k))return date(v);return esc(v)}
function primary(){return ["leaves","adjustments","carryover","shifts","locations","transactions","missing"].includes(key)}
function summary(list){const active=list.filter(x=>["approved","complete","present","active","assigned"].includes(x.status)).length;const pending=list.filter(x=>["pending","partial","late","missing"].includes(x.status)).length;
return '<div class="tm-metrics">'+[
[t("إجمالي السجلات","Total records"),list.length,"layer-group"],
[t("مكتملة / معتمدة","Completed / approved"),active,"circle-check"],
[t("تحتاج متابعة","Needs attention"),pending,"triangle-exclamation"],
[t("عدد الموظفين التجريبي","Demo employees"),persons.length,"users"]
].map(([l,v,i])=>'<div class="tm-metric"><div class="tm-icon">'+icon(i)+'</div><div><small>'+l+'</small><strong>'+v+'</strong></div></div>').join("")+'</div>'}
function filtered(){return rows().filter(x=>{
const p=persons.find(v=>v.id===x.person);const txt=[...Object.values(x),p?.ar,p?.en].join(" ").toLowerCase();
return (!query||txt.includes(query.toLowerCase()))&&(state==="all"||x.status===state)&&(branch==="all"||((p?.b||x.branch)===branch));
})}
function table(list){const f=fields();const start=(page-1)*10;const slice=list.slice(start,start+10);
const head=f.map(x=>"<th>"+x[1]+"</th>").join("");
const body=slice.length?slice.map(row=>'<tr>'+f.map(([k])=>'<td>'+value(row,k)+'</td>').join("")+
'<td><div class="tm-rowtools"><button class="tm-link" data-action="view" data-id="'+esc(row.id)+'">'+t("عرض","View")+'</button>'+
(["leaves","missing","suggestions","adjustments"].includes(key)&&row.status==="pending"?'<button class="tm-link" data-action="approve" data-id="'+esc(row.id)+'">'+t("اعتماد","Approve")+'</button>':"")+'</div></td></tr>').join(""):'<tr><td class="tm-blank" colspan="'+(f.length+1)+'">'+t("لا توجد نتائج مطابقة","No matching records")+'</td></tr>';
return '<div class="tm-table-wrap"><table><thead><tr>'+head+'<th>'+t("الإجراءات","Actions")+'</th></tr></thead><tbody>'+body+'</tbody></table></div>'+
'<div class="tm-pager"><span class="tm-muted tm-small">'+t("عرض","Showing")+" "+(list.length?start+1:0)+"–"+Math.min(start+10,list.length)+" / "+list.length+'</span><div class="tm-actions"><button class="tm-btn" data-action="prev" '+(page<=1?"disabled":"")+'>'+t("السابق","Previous")+'</button><span class="tm-chip">'+page+'</span><button class="tm-btn" data-action="next" '+(page*10>=list.length?"disabled":"")+'>'+t("التالي","Next")+'</button></div></div>'}
function nav(){return '<nav class="tm-nav" aria-label="'+t("صفحات الإجازات والدوام","Leave and attendance pages")+'">'+V.map(v=>'<a href="./time-'+v[0]+'.html" class="'+(v[0]===key?"active":"")+'">'+icon(v[3])+" "+title(v)+'</a>').join("")+'</nav>'}
function render(){const root=$("#tm-root");root.dir=lang==="ar"?"rtl":"ltr";root.classList.toggle("tm-dark",localStorage.getItem("theme")==="dark");document.documentElement.dir=root.dir;document.documentElement.lang=lang;
const list=filtered(),action=key==="imports"?'<button class="tm-btn primary" data-action="import">'+icon("file-arrow-up")+" "+t("استيراد ملف تجريبي","Simulate import")+"</button>":primary()?'<button class="tm-btn primary" data-action="add">'+icon("plus")+" "+t("إضافة سجل تجريبي","Add demo record")+"</button>":'';
root.innerHTML='<header class="tm-top"><div><div class="tm-kicker">'+t("GEM HR / إدارة الإجازات والدوام","GEM HR / Leave & Attendance")+'</div><h1>'+icon(meta[3])+" "+title(meta)+'</h1><div class="tm-muted">'+t("إدارة ومتابعة بيانات الموارد البشرية من واجهة موحدة","Manage and review HR records in one workspace")+'</div></div><div class="tm-actions">'+action+'<button class="tm-btn" data-action="export">'+icon("file-csv")+" "+t("تصدير CSV","Export CSV")+"</button></div></header>"+
'<div class="tm-footnote">'+icon("circle-info")+" "+t("وضع المحاكاة: بيانات افتراضية فقط؛ لا يتم الاتصال بأجهزة ZKTeco أو تعديل بيانات الإنتاج.","Demo mode: fictional data only. No ZKTeco connection or production changes.")+'</div>'+nav()+summary(rows())+
'<section class="tm-card"><div class="tm-card-head"><h2>'+t("السجلات","Records")+'</h2><span class="tm-chip">'+list.length+" "+t("نتيجة","results")+'</span></div>'+
'<div class="tm-toolbar"><input id="tm-q" class="tm-input tm-search" value="'+esc(query)+'" placeholder="'+t("البحث بالاسم أو الرقم أو التفاصيل...","Search employee, ID or details...")+'" aria-label="'+t("بحث","Search")+'">'+
'<select id="tm-status" class="tm-select" aria-label="'+t("الحالة","Status")+'">'+[["all",t("كل الحالات","All statuses")],["pending",t("قيد المراجعة","Pending")],["approved",t("معتمد","Approved")],["present",t("منتظم","Present")],["late",t("متأخر","Late")],["missing",t("ناقص","Missing")],["partial",t("جزئي","Partial")],["active",t("نشط","Active")]].map(([x,n])=>'<option value="'+x+'" '+(x===state?"selected":"")+'>'+n+'</option>').join("")+'</select>'+
'<select id="tm-branch" class="tm-select" aria-label="'+t("الفرع","Branch")+'">'+[["all",t("كل الفروع","All branches")],["hq",bname("hq")],["factory",bname("factory")],["alex",bname("alex")]].map(([x,n])=>'<option value="'+x+'" '+(x===branch?"selected":"")+'>'+n+'</option>').join("")+'</select><button class="tm-btn" data-action="clear">'+t("إعادة تعيين","Reset")+'</button></div>'+table(list)+'</section>';
}
function modal(title,body){document.querySelector(".tm-modal-bg")?.remove();const el=document.createElement("div");el.className="tm-modal-bg";el.innerHTML='<div class="tm-modal" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><h2>'+esc(title)+'</h2>'+body+'<div class="tm-modal-actions"><button class="tm-btn" data-action="close">'+t("إغلاق","Close")+'</button></div></div>';document.body.append(el);}
function toast(msg){document.querySelector(".tm-toast")?.remove();const e=document.createElement("div");e.className="tm-toast";e.textContent=msg;document.body.append(e);setTimeout(()=>e.remove(),2600)}
function input(name,label,type="text",extra=""){return '<label>'+label+'<input class="tm-input" name="'+name+'" type="'+type+'" '+extra+' required></label>'}
function select(name,label,values){return '<label>'+label+'<select name="'+name+'" class="tm-select">'+values.map(([v,n])=>'<option value="'+v+'">'+n+'</option>').join("")+'</select></label>'}
function peopleSelect(){return select("person",t("الموظف","Employee"),persons.map(p=>[p.id,pname(p)]))}
function add(){let f=peopleSelect();const k=key;
if(k==="leaves")f+=select("type",t("نوع الإجازة","Leave type"),[["annual",lv("annual")],["sick",lv("sick")],["casual",lv("casual")]])+input("from",t("من","From"),"date")+input("to",t("إلى","To"),"date");
else if(k==="adjustments"||k==="carryover")f+=select("type",t("نوع الرصيد","Balance type"),[["annual",lv("annual")],["casual",lv("casual")]])+input("days",t("عدد الأيام","Days"),"number",'step="1"')+input("date",t("التاريخ","Date"),"date");
else if(k==="shifts")f+=select("type",t("الوردية","Shift"),[["A","A"],["B","B"],["C","C"],["office",lv("office")]])+input("date",t("التاريخ","Date"),"date")+input("in",t("بداية العمل","Start"),"time")+input("out",t("نهاية العمل","End"),"time");
else if(k==="locations")f+=input("location",t("اسم الموقع","Location"))+select("branch",t("الفرع","Branch"),[["hq",bname("hq")],["factory",bname("factory")],["alex",bname("alex")]])+input("radius",t("نطاق العمل بالمتر","Radius in metres"),"number",'min="20" max="2000"');
else f+=input("date",t("التاريخ","Date"),"date")+select("type",t("نوع الحركة","Movement"),[["in",lv("in")],["out",lv("out")]])+(k==="transactions"?input("in",t("وقت الحضور","Clock in"),"time")+input("out",t("وقت الانصراف","Clock out"),"time"):"");
f+='<label class="wide">'+t("ملاحظات","Notes")+'<textarea class="tm-input" name="reason" placeholder="'+t("ملاحظات توضيحية","Optional notes")+'"></textarea></label>';
modal(t("إضافة سجل تجريبي","Add demo record"),'<form id="tm-add"><div class="tm-form">'+f+'</div><div class="tm-modal-actions"><button class="tm-btn primary" type="submit">'+t("حفظ تجريبي","Save demo")+'</button></div></form>');
}
function importDemo(){modal(t("استيراد سجلات الحضور","Import attendance records"),'<p class="tm-muted">'+t("اختر CSV أو Excel لإظهار معاينة محلية. لا يتم رفع الملف إلى أي خادم.","Select CSV or Excel for a local preview. Nothing is uploaded to a server.")+'</p><form id="tm-import"><label>'+t("اختر الملف","Select file")+'<input class="tm-input" name="file" type="file" accept=".csv,.xlsx,.xls" required></label><div class="tm-modal-actions"><button class="tm-btn primary" type="submit">'+t("محاكاة الاستيراد","Simulate import")+'</button></div></form>')}
function viewRecord(id){const r=rows().find(x=>String(x.id)===String(id));if(!r)return;modal(t("تفاصيل السجل","Record details"),'<div>'+fields().map(([k,label])=>'<div style="display:flex;gap:16px;justify-content:space-between;padding:10px 0;border-bottom:1px solid #e7eef9"><b>'+label+'</b><span>'+value(r,k)+'</span></div>').join("")+'</div>')}
function exportCsv(){const f=fields(),out=[f.map(x=>x[1]),...filtered().map(r=>f.map(([k])=>k==="person"?pname(r[k]):k==="branch"?bname(r[k]):k==="type"?lv(r[k]):String(r[k]??"")))];
const csv=out.map(a=>a.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\r\n");
const url=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"})),a=document.createElement("a");a.href=url;a.download="gem-hr-"+key+"-demo.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
document.addEventListener("click",e=>{const el=e.target.closest("[data-action]");if(!el)return;const a=el.dataset.action;
if(a==="close"){document.querySelector(".tm-modal-bg")?.remove();return}if(a==="clear"){query="";state="all";branch="all";page=1;render();return}
if(a==="next"){page++;render();return}if(a==="prev"){page=Math.max(1,page-1);render();return}
if(a==="view"){viewRecord(el.dataset.id);return}if(a==="add"){add();return}if(a==="import"){importDemo();return}if(a==="export"){exportCsv();return}
if(a==="approve"){const item=rows().find(x=>String(x.id)===el.dataset.id);if(!item)return;const clone={...item,status:"approved"};stored[key]=(stored[key]||[]).filter(x=>String(x.id)!==el.dataset.id);persist(clone);render();toast(t("تم اعتماد السجل في المحاكاة","Record approved in demo"));return}
});
document.addEventListener("submit",e=>{if(e.target.id==="tm-add"){e.preventDefault();const d=Object.fromEntries(new FormData(e.target));const n={...d,id:Date.now(),status:key==="locations"?"active":key==="shifts"?"assigned":key==="transactions"?"present":"pending"};if(key==="leaves"){const days=Math.round((new Date(d.to)-new Date(d.from))/86400000)+1;if(days<1||days>90||!Number.isFinite(days)){toast(t("نطاق التواريخ غير صحيح","Invalid date range"));return}n.days=days;}if(["adjustments","carryover"].includes(key))n.days=Number(d.days);if(key==="locations")n.radius=d.radius+" m";persist(n);document.querySelector(".tm-modal-bg")?.remove();render();toast(t("تم حفظ السجل التجريبي","Demo record saved"));}
if(e.target.id==="tm-import"){e.preventDefault();const file=e.target.querySelector("input[type=file]").files?.[0];if(!file)return;persist({id:Date.now(),file:file.name,date:new Date().toISOString().slice(0,10),total:0,accepted:0,rejected:0,status:"pending",source:"Local file preview"});document.querySelector(".tm-modal-bg")?.remove();render();toast(t("تم تسجيل الملف للمراجعة محلياً، دون رفعه","File staged locally; not uploaded"));}});
document.addEventListener("input",e=>{if(e.target.id!=="tm-q")return;query=e.target.value;page=1;const pos=e.target.selectionStart;render();const input=$("#tm-q");input?.focus();try{input?.setSelectionRange(pos,pos)}catch{}});
document.addEventListener("change",e=>{if(e.target.id==="tm-status"){state=e.target.value;page=1;render()}if(e.target.id==="tm-branch"){branch=e.target.value;page=1;render()}});
window.addEventListener("message",e=>{if(e.origin!==location.origin)return;if(e.data?.gemHrLang){lang=e.data.gemHrLang==="en"?"en":"ar";render()}if(e.data?.theme){$("#tm-root")?.classList.toggle("tm-dark",e.data.theme==="dark")}});
render();
})();