
/* GEM HR • Financial & Requests module • demo data only */
(() => {
'use strict';
const M=[
['payslips','قسائم مرتباتي','My Payslips','money-bill-wave','list'],
['financial','إدارة الحركات المالية','Financial Transactions','money-bill-transfer','list'],
['overtime','إدارة الشغل الإضافي','Overtime Management','clock','list'],
['flights','تذاكر الطيران','Flight Ticket Requests','plane','list'],
['parttime','إدارة الشغل الجزئي','Part-time Work','hourglass-half','list'],
['payroll','إدارة المرتبات','Payroll Management','wallet','list'],
['advances','إدارة السلف','Salary Advances','hand-holding-dollar','list'],
['trips','رحلات الشغل','Business Trips','briefcase','list'],
['expenses','إدارة المصاريف','Expenses','receipt','list'],
['reserves','التكاليف الاحتياطية الشهرية','Monthly Reserved Costs','coins','list'],
['allocations','توزيع مراكز التكلفة','Cost Center Allocations','diagram-project','list'],
['cost-reports','التكاليف المحسوبة والتقارير','Calculated Costs & Reports','chart-line','report'],
['project-timeline','الجداول الزمنية للمشاريع','Project Timelines','calendar-days','list'],
['timeline-comparison','تقرير مقارنة الجداول الزمنية','Timeline Comparison Report','chart-column','report'],
['project-summary','تقرير ملخص المشروع','Project Summary Report','file-lines','report']
];
const active=document.body.dataset.financeView||M[0][0],spec=M.find(x=>x[0]===active)||M[0];
let lang=localStorage.getItem('gem_hr_lang')==='en'?'en':'ar',search='',statusFilter='all',page=1,tab='all';
const root=document.getElementById('rf-root');
const t=(ar,en)=>lang==='ar'?ar:en,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=n=>'<i class="fa-solid fa-'+n+'" aria-hidden="true"></i>';
const people=[['001','أحمد محمد','Ahmed Mohamed','Cairo HQ'],['014','كريم ناجح','Karim Nageh','Cairo Factory'],['020','منى أحمد','Mona Ahmed','Alexandria'],['002','سارة علي','Sara Ali','Cairo HQ'],['016','يوسف خالد','Youssef Khaled','Cairo Factory']];
const nm=id=>{const p=people.find(x=>x[0]===String(id));return p?(lang==='ar'?p[1]:p[2]):'—'};
const money=n=>new Intl.NumberFormat(lang==='ar'?'ar-EG':'en-GB',{maximumFractionDigits:2,numberingSystem:'latn'}).format(Number(n||0))+' '+t('ج.م','EGP');
const date=d=>d?new Intl.DateTimeFormat(lang==='ar'?'ar-EG':'en-GB',{day:'2-digit',month:'short',year:'numeric',numberingSystem:'latn'}).format(new Date(d+'T12:00:00')):'—';
const today='2026-11-27';
const sLabel=s=>({approved:[t('معتمد','Approved'),'ok'],pending:[t('قيد المراجعة','Pending'),'wait'],rejected:[t('مرفوض','Rejected'),'no'],paid:[t('تم الصرف','Paid'),'ok'],draft:[t('مسودة','Draft'),'wait'],completed:[t('مكتمل','Completed'),'ok']})[s]||[esc(s),''];
function badge(v){const [text,cls]=sLabel(v);return '<span class="rf-badge '+cls+'">'+text+'</span>'}
const configs={
payslips:{cols:[['person','الموظف','Employee'],['year','السنة','Year'],['month','الشهر','Month'],['gross','إجمالي المرتب','Gross Pay'],['net','صافي المرتب','Net Pay'],['date','تاريخ الصرف','Payment Date'],['status','الحالة','Status']],data:[
{person:'001',year:2026,month:11,gross:18500,net:15500,date:'2026-11-25',status:'paid'},
{person:'014',year:2026,month:11,gross:8500,net:7400,date:'2026-11-25',status:'paid'},
{person:'020',year:2026,month:10,gross:13200,net:11500,date:'2026-10-25',status:'paid'}]},
financial:{cols:[['person','الموظف','Employee'],['type','نوع الحركة','Transaction Type'],['amount','المبلغ','Amount'],['date','التاريخ','Date'],['note','السبب','Reason'],['status','الحالة','Status']],data:[
{person:'014',type:'bonus',amount:1200,date:'2026-11-18',note:'Performance bonus',status:'approved'},
{person:'020',type:'deduction',amount:250,date:'2026-11-19',note:'Adjustment',status:'pending'},
{person:'001',type:'allowance',amount:500,date:'2026-11-22',note:'Transport',status:'approved'}]},
overtime:{cols:[['person','الموظف','Employee'],['date','اليوم','Date'],['hours','ساعات إضافية','Overtime Hours'],['rate','سعر الساعة','Hourly Rate'],['amount','المبلغ','Amount'],['status','الحالة','Status']],data:[
{person:'014',date:'2026-11-23',hours:3,rate:75,amount:225,status:'pending'},
{person:'016',date:'2026-11-20',hours:4,rate:60,amount:240,status:'approved'},
{person:'001',date:'2026-11-18',hours:2,rate:95,amount:190,status:'approved'}]},
flights:{cols:[['person','الموظف','Employee'],['destination','الوجهة','Destination'],['from','تاريخ السفر','Travel Date'],['to','العودة','Return Date'],['amount','التكلفة','Cost'],['status','الحالة','Status']],data:[]},
parttime:{cols:[['person','الموظف','Employee'],['date','التاريخ','Date'],['hours','ساعات الشغل','Work Hours'],['rate','سعر الساعة','Rate'],['amount','الإجمالي','Total'],['status','الحالة','Status']],data:[]},
payroll:{cols:[['person','الموظف','Employee'],['year','السنة','Year'],['month','الشهر','Month'],['gross','الإجمالي','Gross'],['deductions','الخصومات','Deductions'],['net','الصافي','Net'],['status','الحالة','Status']],data:[
{person:'001',year:2026,month:11,gross:18500,deductions:3000,net:15500,status:'paid'},
{person:'014',year:2026,month:11,gross:8500,deductions:1100,net:7400,status:'paid'},
{person:'020',year:2026,month:11,gross:13200,deductions:1700,net:11500,status:'pending'}]},
advances:{cols:[['person','الموظف','Employee'],['amount','قيمة السلفة','Advance Amount'],['installments','عدد الأقساط','Installments'],['date','تاريخ الطلب','Request Date'],['balance','المتبقي','Outstanding'],['status','الحالة','Status']],data:[
{person:'014',amount:3000,installments:3,date:'2026-11-03',balance:2000,status:'approved'},
{person:'016',amount:5000,installments:5,date:'2026-11-15',balance:5000,status:'pending'},
{person:'020',amount:2500,installments:2,date:'2026-11-20',balance:2500,status:'pending'}]},
trips:{cols:[['person','الموظف','Employee'],['destination','الوجهة','Destination'],['from','من','From'],['to','إلى','To'],['amount','التكلفة','Cost'],['status','الحالة','Status']],data:[]},
expenses:{cols:[['person','الموظف','Employee'],['type','نوع المصروف','Expense Type'],['date','التاريخ','Date'],['amount','المبلغ','Amount'],['note','الوصف','Description'],['status','الحالة','Status']],data:[]},
reserves:{cols:[['person','الموظف','Employee'],['month','الشهر','Month'],['amount','المبلغ','Amount'],['type','النوع','Type'],['status','الحالة','Status']],data:[]},
allocations:{cols:[['person','الموظف','Employee'],['project','المشروع','Project'],['costCenter','مركز التكلفة','Cost Center'],['percentage','النسبة','Percentage'],['date','التاريخ','Date'],['status','الحالة','Status']],data:[]},
'cost-reports':{cols:[['project','المشروع','Project'],['costCenter','مركز التكلفة','Cost Center'],['amount','التكلفة','Cost'],['date','التاريخ','Date']],data:[]},
'project-timeline':{cols:[['project','المشروع','Project'],['person','الموظف','Employee'],['from','البداية','Start'],['to','النهاية','End'],['status','الحالة','Status']],data:[]},
'timeline-comparison':{cols:[['project','المشروع','Project'],['planned','المخطط','Planned'],['actual','الفعلي','Actual'],['variance','الفرق','Difference']],data:[]},
'project-summary':{cols:[['project','المشروع','Project'],['hours','ساعات الشغل','Work Hours'],['amount','التكلفة','Cost'],['status','الحالة','Status']],data:[]}
};
const types={bonus:[t('مكافأة','Bonus')],deduction:[t('خصم','Deduction')],allowance:[t('بدل','Allowance')]};
function getStore(){try{return JSON.parse(localStorage.getItem('gem_hr_finance_demo'))||{}}catch{return {}}}
let persisted=getStore();
function rows(){let map=new Map((configs[active].data||[]).map((r,i)=>[String(i+1),{...r,id:i+1}]));(persisted[active]||[]).forEach(r=>map.set(String(r.id),r));return [...map.values()]}
function write(r){persisted[active]||=[];persisted[active].push(r);localStorage.setItem('gem_hr_finance_demo',JSON.stringify(persisted))}
function cell(r,k){const v=r[k];if(k==='person')return esc(nm(v));if(k==='status')return badge(v);if(['gross','net','amount','balance','deductions','rate'].includes(k))return money(v);if(['date','from','to'].includes(k))return date(v);if(k==='type')return types[v]?.[0]||esc(v);if(k==='percentage')return esc(v)+'%';return esc(v??'—')}
function colName(c){return t(c[1],c[2])}
function nav(){return '<nav class="rf-tabs" aria-label="'+t('صفحات الطلبات والمالية','Requests and financial pages')+'">'+M.map(m=>'<a href="./finance-'+m[0]+'.html" class="'+(active===m[0]?'active':'')+'">'+icon(m[3])+' '+t(m[1],m[2])+'</a>').join('')+'</nav>'}
function filtered(){return rows().filter(r=>{const p=nm(r.person||'');const text=[...Object.values(r),p].join(' ').toLowerCase();return (!search||text.includes(search.toLowerCase()))&&(statusFilter==='all'||r.status===statusFilter)})}
function table(list){const cfg=configs[active],cols=cfg.cols,chunk=list.slice((page-1)*10,page*10);return '<div class="rf-table"><table><thead><tr>'+cols.map(c=>'<th>'+colName(c)+'</th>').join('')+'<th>'+t('التفاصيل','Details')+'</th></tr></thead><tbody>'+(chunk.length?chunk.map(r=>'<tr>'+cols.map(c=>'<td>'+cell(r,c[0])+'</td>').join('')+'<td><button class="rf-link" data-action="view" data-id="'+esc(r.id)+'">'+t('عرض','View')+'</button></td></tr>').join(''):'<tr><td colspan="'+(cols.length+1)+'" class="rf-empty">'+t('مفيش نتائج للبحث ده','No matching records')+'</td></tr>')+'</tbody></table></div><div class="rf-pager"><span class="rf-muted">'+t('عدد النتائج','Results')+': '+list.length+'</span><div class="rf-actions"><button class="rf-btn" data-action="previous" '+(page===1?'disabled':'')+'>'+t('السابق','Previous')+'</button><span class="rf-badge">'+page+'</span><button class="rf-btn" data-action="next" '+(page*10>=list.length?'disabled':'')+'>'+t('التالي','Next')+'</button></div></div>'}
function summary(list){const totals=list.reduce((n,r)=>n+(Number(r.amount)||Number(r.net)||0),0);return '<div class="rf-summary">'+[
[t('إجمالي السجلات','Total Records'),list.length], [t('في انتظار المراجعة','Pending Review'),list.filter(r=>r.status==='pending').length],[t('تم اعتمادها','Approved'),list.filter(r=>r.status==='approved'||r.status==='paid').length],[t('مبلغ توضيحي','Illustrative Amount'),money(totals)]
].map(([k,v])=>'<div class="rf-stat"><span>'+k+'</span><strong>'+v+'</strong></div>').join('')+'</div>'}
const reportFields={
'cost-reports':[['year',t('السنة','Year'),'number'],['month',t('الشهر','Month'),'number'],['project',t('المشروع','Project'),'text']],
'timeline-comparison':[['from',t('من تاريخ','From Date'),'date'],['to',t('إلى تاريخ','To Date'),'date'],['employee',t('الموظف','Employee'),'text'],['project',t('المشروع','Project'),'text']],
'project-summary':[['project',t('المشروع','Project'),'text'],['from',t('من تاريخ','From Date'),'date'],['to',t('إلى تاريخ','To Date'),'date']]
};
function report(){return '<div class="rf-card rf-form-card"><h2>'+t('معايير التقرير','Report Parameters')+'</h2><form id="rf-report" class="rf-form">'+(reportFields[active]||[]).map(([k,l,type])=>'<label>'+l+'<input class="rf-input" type="'+type+'" name="'+k+'" '+(k==='year'?'value="2026"':k==='month'?'value="11"':'')+'></label>').join('')+'<div class="rf-actions"><button class="rf-btn primary" type="submit">'+icon('chart-line')+' '+t('عرض التقرير التجريبي','Preview Demo Report')+'</button><button type="button" class="rf-btn" data-action="export">'+t('تصدير CSV','Export CSV')+'</button></div></form><p class="rf-note">'+t('محتوى التقارير يظهر بعد ربط البيانات الفعلية مع الصلاحيات.','Report results require backend data and access controls. This is a mock interface.')+'</p></div><section class="rf-card"><h2>'+t('نتائج التقرير','Report Results')+'</h2>'+table(filtered())+'</section>'}
function display(){const name=t(spec[1],spec[2]);root.dir=lang==='ar'?'rtl':'ltr';document.documentElement.lang=lang;document.documentElement.dir=root.dir;root.classList.toggle('dark',localStorage.getItem('theme')==='dark');const list=filtered();root.innerHTML='<header class="rf-head"><div><div class="rf-kicker">GEM HR / '+t('الطلبات والإدارة المالية','Requests & Finance')+'</div><h1>'+icon(spec[3])+' '+name+'</h1><div class="rf-muted">'+t('مساحة عمل تجريبية لشئون العاملين والمالية','Demo workspace for employee and finance requests')+'</div></div><div class="rf-actions">'+(spec[4]==='list'?'<button class="rf-btn primary" data-action="create">'+icon('plus')+' '+t('إضافة طلب تجريبي','Add Demo Request')+'</button>':'')+'<button class="rf-btn" data-action="export">'+icon('file-csv')+' CSV</button></div></header>'+
'<div class="rf-banner">'+icon('circle-info')+' '+t('دي نسخة تجريبية. كل الأرقام والمرتبات والأسماء للتوضيح فقط، ومفيش أي بيانات حقيقية بتتسجل أو بتتعدل.','Demo only: all names and financial figures are fictional. No real employee or payroll records are accessed.')+'</div>'+nav()+(spec[4]==='report'?report():summary(rows())+'<section class="rf-card"><h2>'+name+'</h2><div class="rf-toolbar"><input class="rf-input rf-search" id="rf-search" placeholder="'+t('دور على موظف أو رقم أو نوع الحركة...','Search employee or transaction...')+'" value="'+esc(search)+'"><select class="rf-select" id="rf-filter"><option value="all">'+t('كل الحالات','All statuses')+'</option>'+['pending','approved','paid','rejected','draft'].map(s=>'<option value="'+s+'" '+(s===statusFilter?'selected':'')+'>'+sLabel(s)[0]+'</option>').join('')+'</select><button class="rf-btn" data-action="clear">'+t('مسح البحث','Clear')+'</button></div>'+table(list)+'</section>')};
function modal(title,body){document.querySelector('.rf-modal-overlay')?.remove();let e=document.createElement('div');e.className='rf-modal-overlay';e.innerHTML='<section class="rf-modal" role="dialog" aria-modal="true"><h2>'+esc(title)+'</h2>'+body+'<div class="rf-modal-foot"><button class="rf-btn" data-action="close">'+t('إغلاق','Close')+'</button></div></section>';document.body.append(e)}
function input(name,label,type='text',extra=''){return '<label>'+label+'<input class="rf-input" type="'+type+'" name="'+name+'" '+extra+' required></label>'}
function select(name,label,opts){return '<label>'+label+'<select class="rf-select" name="'+name+'">'+opts.map(([v,l])=>'<option value="'+v+'">'+l+'</option>').join('')+'</select></label>'}
function create(){let f=select('person',t('الموظف','Employee'),people.map(p=>[p[0],nm(p[0])]));
const exclude=new Set(['person','status','id','net','gross','deductions','balance','year','month']);for(const [k,ar,en] of configs[active].cols){if(exclude.has(k))continue;
if(k==='type')f+=select(k,t(ar,en),[['bonus',t('مكافأة','Bonus')],['allowance',t('بدل','Allowance')],['deduction',t('خصم','Deduction')],['annual',t('سنوي','Annual')]]);else f+=input(k,t(ar,en),['date','from','to'].includes(k)?'date':['hours','rate','amount','installments','percentage'].includes(k)?'number':'text',k==='percentage'?'min="0" max="100"':"");
}f+='<label class="wide">'+t('ملاحظات','Notes')+'<textarea class="rf-input" name="note" placeholder="'+t('سبب الطلب أو الملاحظات','Reason or notes')+'"></textarea></label>';
modal(t('إضافة سجل تجريبي','Add Demo Record'),'<form id="rf-create"><div class="rf-form">'+f+'</div><div class="rf-modal-foot"><button class="rf-btn primary" type="submit">'+t('حفظ تجريبي','Save Demo')+'</button></div></form>')}
function toast(txt){document.querySelector('.rf-toast')?.remove();const n=document.createElement('div');n.className='rf-toast';n.textContent=txt;document.body.append(n);setTimeout(()=>n.remove(),2500)}
function exportCsv(){const cfg=configs[active],out=[cfg.cols.map(colName),...filtered().map(r=>cfg.cols.map(c=>c[0]==='person'?nm(r.person):r[c[0]]??''))];const csv=out.map(row=>row.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\r\n');const u=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download='gem-hr-'+active+'-demo.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
document.addEventListener('click',e=>{const x=e.target.closest('[data-action]');if(!x)return;const a=x.dataset.action;if(a==='close'){document.querySelector('.rf-modal-overlay')?.remove();return}if(a==='clear'){search='';statusFilter='all';page=1;display();return}if(a==='next'){page++;display();return}if(a==='previous'){page=Math.max(1,page-1);display();return}if(a==='create'){create();return}if(a==='export'){exportCsv();return}if(a==='view'){const row=rows().find(r=>String(r.id)===x.dataset.id);if(!row)return;modal(t('تفاصيل السجل','Record Details'),configs[active].cols.map(c=>'<div style="display:flex;justify-content:space-between;border-bottom:1px solid #e5ebf7;padding:9px;gap:14px"><b>'+colName(c)+'</b><span>'+cell(row,c[0])+'</span></div>').join(''))}});
document.addEventListener('input',e=>{if(e.target.id!=='rf-search')return;search=e.target.value;page=1;const caret=e.target.selectionStart;display();let el=document.getElementById('rf-search');el?.focus();try{el?.setSelectionRange(caret,caret)}catch{}});
document.addEventListener('change',e=>{if(e.target.id==='rf-filter'){statusFilter=e.target.value;page=1;display()}});
document.addEventListener('submit',e=>{if(e.target.id==='rf-create'){e.preventDefault();let d=Object.fromEntries(new FormData(e.target));const row={...d,id:Date.now(),status:'pending'};['amount','hours','rate','installments','percentage'].forEach(k=>{if(row[k]!==undefined)row[k]=Number(row[k])});if(row.hours&&row.rate)row.amount=row.hours*row.rate;if(row.from&&row.to&&row.to<row.from){toast(t('راجع التواريخ','Check date range'));return}write(row);document.querySelector('.rf-modal-overlay')?.remove();display();toast(t('الطلب اتسجل في النسخة التجريبية','Demo request saved'))}if(e.target.id==='rf-report'){e.preventDefault();toast(t('ده عرض تجريبي. التقرير الفعلي محتاج ربط الـ API.','Preview only: live reports require backend APIs.'))}});
window.addEventListener('message',e=>{if(e.origin!==location.origin)return;if(e.data?.gemHrLang){lang=e.data.gemHrLang==='en'?'en':'ar';display()}if(e.data?.theme){root.classList.toggle('dark',e.data.theme==='dark')}});
display();
})();