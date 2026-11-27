const REPORT_DEFINITIONS=[["custom","مُنشئ التقارير المخصصة","Custom Report Builder","builder"],["employee-info","تقرير معلومات الموظفين","Employee Information","employees"],["competencies","تقرير كفاءات الموظفين","Employee Competencies","employees"],["disciplinary","تقرير الإجراءات التأديبية","Disciplinary Actions","employees"],["misc-requests","تقرير الطلبات المتفرقة","Miscellaneous Requests","requests"],["headcount","تقرير عدد الموظفين","Employee Headcount","headcount"],["leave-movements","تقرير الإجازات والمغادرات","Leave & Permissions","leave"],["leave-balances","تقرير أرصدة الإجازات","Leave Balances","leave"],["attendance-cumulative","تقرير الحضور والانصراف التراكمي","Cumulative Attendance","attendance"],["employee-attendance","تقرير حركات حضور وانصراف الموظفين","Employee Attendance","attendance"],["daily-worksheets","تقرير أوراق الشغل اليومية","Daily Work Sheets","attendance"],["monthly-worksheets","تقرير أوراق الشغل الشهرية","Monthly Work Sheets","attendance"],["payroll","تقرير المرتبات","Payroll","finance"],["salary-settlement","تقرير تسوية المرتب","Salary Settlement","finance"],["termination","تقرير إنهاء الخدمة","Employee Termination","employees"],["reserved-cost","تقرير التكلفة الاحتياطية","Reserved Cost","finance"],["bank-export","تقرير تصدير نموذج البنك","Bank Export","bank"],["bank-nonpayroll","تقرير الحركات البنكية خارج المرتبات","Non-Payroll Banking","bank"],["financial-movements","تقرير الحركات المالية","Financial Movements","finance"],["flight-movements","تقرير حركات تذاكر الطيران","Flight Tickets","requests"],["advances","تقرير السلف","Salary Advances","finance"],["salary-packages","تقرير حزم المرتبات","Salary Packages","finance"],["competitive-ratio","تقرير النسبة التنافسية","Compensation Competitiveness","finance"],["social-insurance-2","استمارة ٢ - تقرير التأمينات الاجتماعية","Social Insurance Form 2","insurance"]];
/* GEM HR General Reports: UI preview, fictional employee and financial data only */
(() => {
"use strict";
const defs=REPORT_DEFINITIONS;
const root=document.getElementById("rp-root");
const current=defs.find(d=>d[0]===document.body.dataset.report)||defs[0];
let lang=localStorage.getItem("gem_hr_lang")==="en"?"en":"ar";
let results=[],shown=false,offset=0;
const t=(ar,en)=>lang==="ar"?ar:en;
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const staff=[
{id:"001",ar:"أحمد محمد",en:"Ahmed Mohamed",dept:"IT",branch:"hq",salary:17000,leave:14,late:0},
{id:"002",ar:"سارة علي",en:"Sara Ali",dept:"HR",branch:"hq",salary:15300,leave:18,late:1},
{id:"014",ar:"كريم ناجح",en:"Karim Nageh",dept:"Production",branch:"factory",salary:8100,leave:7,late:2},
{id:"016",ar:"يوسف خالد",en:"Youssef Khaled",dept:"Warehouse",branch:"factory",salary:10300,leave:9,late:0},
{id:"020",ar:"منى أحمد",en:"Mona Ahmed",dept:"Finance",branch:"alex",salary:12700,leave:11,late:1},
{id:"022",ar:"محمد حسن",en:"Mohamed Hassan",dept:"Operations",branch:"factory",salary:20500,leave:20,late:0}
];
const branch=b=>({hq:t("المقر الرئيسي","Head Office"),factory:t("مصنع القاهرة","Cairo Factory"),alex:t("فرع إسكندرية","Alexandria Branch")})[b]||b;
const name=p=>lang==="ar"?p.ar:p.en;
const fields={
employees:["branch","department","employee","status","from","to"],
headcount:["branch","department","from","to"],
requests:["branch","department","employee","status","from","to"],
leave:["branch","department","employee","leaveType","from","to"],
attendance:["branch","department","employee","shift","from","to"],
finance:["branch","department","employee","month","year"],
bank:["branch","employee","bank","month","year"],
insurance:["branch","employee","month","year"],
builder:["branch","department","from","to"]
};
const options=(n,label,list)=>'<label>'+label+'<select name="'+n+'" class="rp-select">'+list.map(pair=>'<option value="'+safe(pair[0])+'">'+safe(pair[1])+'</option>').join("")+'</select></label>';
const input=(n,label,type,val)=>'<label>'+label+'<input name="'+n+'" class="rp-input" type="'+type+'" value="'+(val||"")+'"></label>';
function field(n) {
if(n==="branch")return options(n,t("الفرع","Branch"),[["",t("كل الفروع","All branches")],["hq",branch("hq")],["factory",branch("factory")],["alex",branch("alex")]]);
if(n==="department")return options(n,t("القسم","Department"),[["",t("كل الأقسام","All departments")],...["HR","IT","Production","Finance","Warehouse","Operations"].map(x=>[x,x])]);
if(n==="employee")return options(n,t("الموظف","Employee"),[["",t("كل الموظفين","All employees")],...staff.map(x=>[x.id,name(x)])]);
if(n==="status")return options(n,t("الحالة","Status"),[["",t("كل الحالات","All statuses")],["active",t("نشط","Active")],["pending",t("قيد المراجعة","Pending")]]);
if(n==="leaveType")return options(n,t("نوع الإجازة","Leave type"),[["",t("كل الأنواع","All types")],["annual",t("سنوية","Annual")],["sick",t("مرضية","Sick")]]);
if(n==="shift")return options(n,t("الوردية","Shift"),[["",t("كل الورديات","All shifts")],["A","A"],["B","B"],["office",t("مكتبي","Office")]]);
if(n==="bank")return options(n,t("البنك","Bank"),[["",t("كل البنوك","All banks")],["sample",t("بنك افتراضي","Demo Bank")]]);
if(n==="month")return options(n,t("الشهر","Month"),Array.from({length:12},(_,i)=>[String(i+1),String(i+1)]));
if(n==="year")return options(n,t("السنة","Year"),[["2026","2026"],["2025","2025"]]);
if(n==="from")return input(n,t("من تاريخ","From date"),"date","2026-11-01");
if(n==="to")return input(n,t("لحد تاريخ","To date"),"date","2026-11-27");
return "";
}
const columnDefs={
employees:[["id","الرقم","ID"],["name","الموظف","Employee"],["dept","القسم","Department"],["branch","الفرع","Branch"]],
headcount:[["branch","الفرع","Branch"],["dept","القسم","Department"],["count","العدد","Headcount"]],
requests:[["name","الموظف","Employee"],["date","التاريخ","Date"],["type","نوع الطلب","Request"],["status","الحالة","Status"]],
leave:[["name","الموظف","Employee"],["type","الإجازة","Leave"],["leave","الرصيد","Balance"],["date","التاريخ","Date"]],
attendance:[["name","الموظف","Employee"],["date","التاريخ","Date"],["in","حضور","Check-in"],["out","انصراف","Check-out"],["late","التأخير بالدقيقة","Late (min)"]],
finance:[["name","الموظف","Employee"],["month","الشهر","Month"],["amount","المبلغ (ج.م)","Amount (EGP)"]],
bank:[["name","الموظف","Employee"],["bank","البنك","Bank"],["amount","المبلغ (ج.م)","Amount (EGP)"]],
insurance:[["name","الموظف","Employee"],["date","تاريخ التعيين","Hire date"],["status","الحالة","Status"]]
};
const group=()=>current[3]==="builder"?"employees":current[3];
const cols=()=>columnDefs[group()]||columnDefs.employees;
function makeRows(v){
const chosen=staff.filter(p=>(!v.branch||p.branch===v.branch)&&(!v.department||p.dept===v.department)&&(!v.employee||p.id===v.employee));
if(group()==="headcount"){const m=new Map();chosen.forEach(p=>{const k=p.branch+"|"+p.dept;const old=m.get(k);m.set(k,{branch:branch(p.branch),dept:p.dept,count:(old?old.count:0)+1})});return [...m.values()]}
return chosen.map((p,i)=>({id:p.id,name:name(p),dept:p.dept,branch:branch(p.branch),date:"2026-11-"+String(20+i).padStart(2,"0"),type:t("طلب إجازة","Leave request"),status:i%2?t("معتمد","Approved"):t("قيد المراجعة","Pending"),leave:p.leave,in:"09:00",out:"17:00",late:p.late*5,month:v.month||"11",amount:p.salary,bank:t("بنك افتراضي","Demo bank")}));
}
function builder(){
if(current[0]!=="custom")return "";
const opts=[["id",t("الرقم","ID")],["name",t("الاسم","Name")],["dept",t("القسم","Department")],["branch",t("الفرع","Branch")]];
return '<section class="rp-card"><h2>'+t("اختيار الأعمدة","Choose columns")+'</h2><div class="rp-fieldset">'+opts.map(v=>'<label><input name="rp-column" type="checkbox" value="'+v[0]+'" checked> '+v[1]+'</label>').join("")+'</div></section>';
}
function resultTable(){
if(!shown)return '<div class="rp-card rp-muted">'+t("اختار الفلاتر واضغط عرض التقرير علشان تشوف مثال بالبيانات الوهمية.","Choose filters and preview fictional report results.")+'</div>';
let cc=cols();
const selected=[...document.querySelectorAll('[name="rp-column"]:checked')].map(x=>x.value);
if(current[0]==="custom"&&selected.length)cc=cc.filter(c=>selected.includes(c[0]));
const slice=results.slice(offset,offset+10);
return '<section class="rp-card"><h2>'+t("نتائج التقرير التجريبي","Demo Report Results")+'</h2><div class="rp-table"><table><thead><tr>'+cc.map(c=>'<th>'+t(c[1],c[2])+'</th>').join("")+'</tr></thead><tbody>'+(slice.length?slice.map(r=>'<tr>'+cc.map(c=>'<td>'+safe(r[c[0]]??"—")+'</td>').join("")+'</tr>').join(""):'<tr><td class="rp-empty" colspan="'+cc.length+'">'+t("مفيش نتائج","No results")+'</td></tr>')+'</tbody></table></div><div class="rp-pager"><span class="rp-muted">'+results.length+" "+t("نتائج","results")+'</span><div class="rp-actions"><button class="rp-btn" data-act="prev" '+(offset===0?"disabled":"")+'>'+t("السابق","Previous")+'</button><button class="rp-btn" data-act="next" '+(offset+10>=results.length?"disabled":"")+'>'+t("التالي","Next")+'</button></div></div></section>';
}
function render(){
root.dir=lang==="ar"?"rtl":"ltr";document.documentElement.lang=lang;document.documentElement.dir=root.dir;root.classList.toggle("dark",localStorage.getItem("theme")==="dark");
root.innerHTML='<div class="rp-top"><div><div class="rp-kicker">GEM HR / '+t("التقارير العامة","General Reports")+'</div><h1>'+t(current[1],current[2])+'</h1></div><div class="rp-actions"><button class="rp-btn" data-act="export">'+t("تصدير CSV","Export CSV")+'</button><button class="rp-btn" data-act="print">'+t("طباعة","Print")+'</button></div></div>'+
'<div class="rp-note">'+t("نسخة تجريبية ببيانات افتراضية فقط. تقارير البنوك والمرتبات والتأمينات مش مستندات رسمية.","Fictional demo data only. Banking, payroll and insurance reports are not official records.")+'</div>'+
'<nav class="rp-nav">'+defs.map(d=>'<a class="'+(d[0]===current[0]?"active":"")+'" href="./report-'+d[0]+'.html">'+t(d[1],d[2])+'</a>').join("")+'</nav>'+
builder()+'<section class="rp-card"><h2>'+t("فلاتر التقرير","Report Filters")+'</h2><form class="rp-form" id="rp-form">'+(fields[current[3]]||fields.employees).map(field).join("")+
'<div class="rp-form-actions"><button class="rp-btn primary" type="submit">'+t("عرض التقرير","Preview Report")+'</button><button class="rp-btn" type="reset" data-act="reset">'+t("مسح الفلاتر","Reset")+'</button></div></form></section>'+resultTable();
}
function exportCsv(){
if(!shown)return;
const cc=cols();
const lines=[cc.map(c=>t(c[1],c[2])),...results.map(r=>cc.map(c=>r[c[0]]??""))];
const csv=lines.map(row=>row.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(",")).join("\r\n");
const u=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));
const a=document.createElement("a");a.href=u;a.download="gem-hr-demo-"+current[0]+".csv";a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
}
document.addEventListener("submit",e=>{
if(e.target.id!=="rp-form")return;e.preventDefault();
const values=Object.fromEntries(new FormData(e.target));
if(values.from&&values.to&&values.from>values.to){alert(t("راجع التواريخ","Check the dates"));return}
results=makeRows(values);shown=true;offset=0;render();
});
document.addEventListener("click",e=>{
const a=e.target.closest("[data-act]");if(!a)return;
if(a.dataset.act==="export")exportCsv();
if(a.dataset.act==="print"&&shown)window.print();
if(a.dataset.act==="prev"){offset=Math.max(0,offset-10);render()}
if(a.dataset.act==="next"){offset+=10;render()}
if(a.dataset.act==="reset"){shown=false;results=[];offset=0;setTimeout(render,0)}
});
window.addEventListener("message",e=>{
if(e.origin!==location.origin)return;
if(e.data?.gemHrLang){lang=e.data.gemHrLang==="en"?"en":"ar";shown=false;render()}
if(e.data?.theme)root.classList.toggle("dark",e.data.theme==="dark");
});
render();
})();