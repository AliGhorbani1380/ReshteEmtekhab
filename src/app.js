(function () {
  'use strict';
  const STORAGE_KEY = 'olaviatchin-v1-data';
  const VERSION = 1;
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const base = clone(window.DEFAULT_CHOICES);
  const el = id => document.getElementById(id);
  const FA = val => Number(val).toLocaleString('fa-IR');
  const pages = [1,2,3,4,5,7,8,9];
  const state = {items: load(),category:'all',status:'all',search:'',undo:[],redo:[],openMenu:null};
  let toastTimeout = null, modalCleanup = null, drag = null;

  function load() {
    try {
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));
      if(saved && saved.version===VERSION && Array.isArray(saved.items) && validItems(saved.items)) return saved.items.map(cleanItem);
    } catch(e) {console.warn('Local backup was not readable',e);}
    return clone(base);
  }
  function cleanItem(a) {
    return {id:String(a.id),title:String(a.title).slice(0,350),code:normalCode(a.code).slice(0,25),active:!!a.active,review:!!a.review,sourcePage:Number(a.sourcePage)||0,sourceRow:Number(a.sourceRow)||0,note:String(a.note||'').slice(0,1200)};
  }
  function validItems(arr) {
    if(arr.length>1000) return false;
    const ids=new Set();
    return arr.every(a=>a && typeof a==='object' && typeof a.id==='string' && !ids.has(a.id) && (ids.add(a.id),true) && typeof a.title==='string' && a.title.length<=350 && typeof a.code==='string' && a.code.length<=25 && typeof a.active==='boolean' && typeof a.review==='boolean' && (typeof a.note==='string'||typeof a.note==='undefined'));
  }
  function normalCode(code) {return String(code??'').replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776)).replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632)).trim();}
  function escapeHtml(raw) {return String(raw).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function category(item) {
    const s=item.title.replaceAll('ي','ی');
    if (s.startsWith('دندان‌پزشکی')||s.startsWith('دندان پزشکی')) return 'دندان‌پزشکی';
    if (s.startsWith('پزشکی')) return 'پزشکی';
    if (s.startsWith('داروسازی')) return 'داروسازی';
    return 'سایر';
  }
  function getDuplicates() {
    const codes=new Map();
    for(const item of state.items) if(item.active && item.code) codes.set(item.code,(codes.get(item.code)||0)+1);
    return new Set([...codes].filter(([,n])=>n>1).map(([code])=>code));
  }
  function commit(items,message) {
    if(JSON.stringify(items)===JSON.stringify(state.items))return;
    state.undo.push(clone(state.items)); if(state.undo.length>40)state.undo.shift();
    state.redo.length=0; state.items=items;
    persist();render();if(message)notify(message);
  }
  function persist() {
    try {localStorage.setItem(STORAGE_KEY,JSON.stringify({version:VERSION,items:state.items,updatedAt:new Date().toISOString()}));
      el('saveStatus').innerHTML='<span class="status-dot"></span>ذخیره‌شده در این مرورگر';
    } catch(e) {el('saveStatus').textContent='فضای ذخیره مرورگر پر است؛ پشتیبان بگیرید';notify('ذخیره خودکار انجام نشد؛ یک فایل پشتیبان بگیرید.');}
  }
  function notify(message) {
    const t=el('toast');t.textContent=message;t.classList.add('shown');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>t.classList.remove('shown'),3300);
  }
  function undo() {if(!state.undo.length)return;state.redo.push(clone(state.items));state.items=state.undo.pop();persist();render();notify('تغییر قبلی برگردانده شد.');}
  function redo() {if(!state.redo.length)return;state.undo.push(clone(state.items));state.items=state.redo.pop();persist();render();notify('تغییر دوباره انجام شد.');}
  function viewItems(){
    const q=normalCode(state.search).toLowerCase();
    return state.items.map((item,index)=>({item,index})).filter(({item})=>{
      if(state.category!=='all'&&category(item)!==state.category)return false;
      if(state.status==='active'&&!item.active)return false;
      if(state.status==='inactive'&&item.active)return false;
      if(state.status==='review'&&!item.review)return false;
      if(q&&!normalCode(item.title+' '+item.code+' '+item.note+' '+item.sourceRow).toLowerCase().includes(q))return false;
      return true;
    });
  }
  function render(){
    const all=state.items, visible=viewItems(), dup=getDuplicates();
    el('totalCount').textContent=FA(all.length);
    el('activeCount').textContent=FA(all.filter(x=>x.active).length);
    el('reviewCount').textContent=FA(all.filter(x=>x.review).length);
    el('inactiveCount').textContent=FA(all.filter(x=>!x.active).length);
    el('listCount').textContent=FA(all.length);
    el('visibleCount').textContent=FA(visible.length);
    el('footerCount').textContent=`نمایش ${FA(visible.length)} از ${FA(all.length)} انتخاب`;
    el('undoBtn').disabled=!state.undo.length;el('redoBtn').disabled=!state.redo.length;
    const isFiltered=!!(state.search||state.category!=='all'||state.status!=='all');
    el('dragNotice').textContent=isFiltered?'برای کشیدن و جابه‌جایی، فیلتر و جستجو را پاک کنید.':'با دستگیره بکشید؛ برای انتقال دقیق از منوی ⋯ استفاده کنید.';
    el('choices').innerHTML=visible.length ? visible.map(({item,index})=>{
      const cat=category(item); const catStyle=cat==='پزشکی'?'badge-medical':cat==='دندان‌پزشکی'?'badge-dental':cat==='داروسازی'?'badge-pharmacy':'badge-other';
      const dupe=item.code&&dup.has(item.code);
      const badgeReview=item.review?'<span class="review-flag" title="بهتر است متن را با تصویر منبع مقایسه کنید">⚑ بازبینی</span>':'';
      const badgeDupe=dupe?'<span class="review-flag" title="این کد در چند انتخاب فعال تکرار شده است">⚠ کد تکراری</span>':'';
      return `<article class="choice ${item.active?'':'inactive'}" data-id="${escapeHtml(item.id)}" data-idx="${index}">
        <button class="grip" type="button" data-action="grip" title="کشیدن برای جابه‌جایی؛ با Alt + ↑/↓ نیز حرکت می‌کند" aria-label="جابجایی انتخاب ${FA(index+1)}" ${isFiltered?'disabled':''}>⠿</button>
        <span class="choice-rank">${FA(index+1)}</span>
        <div class="choice-main"><div class="choice-title">${escapeHtml(item.title)}</div><div class="choice-sub"><span class="badge-choice ${catStyle}">${escapeHtml(cat)}</span>${badgeReview}${badgeDupe}${!item.active?'<span class="review-flag">غیرفعال</span>':''}${item.note?'<span title="دارای یادداشت">✎ یادداشت</span>':''}${item.sourcePage?`<span class="source-mini">از تصویر ${FA(pages.indexOf(item.sourcePage)+1)} <button type="button" data-action="source">دیدن</button></span>`:''}</div></div>
        <span class="choice-code ${item.code?'':'empty'}" title="کدرشته را با دفترچه سنجش تطبیق دهید">${escapeHtml(item.code)||'بدون کد'}</span>
        <div class="choice-actions"><button type="button" class="row-action" data-action="edit" title="ویرایش" aria-label="ویرایش">✎</button><button type="button" class="row-action toggle" data-action="toggle" title="${item.active?'غیرفعال کردن':'فعال کردن'}" aria-label="${item.active?'غیرفعال کردن':'فعال کردن'}">${item.active?'◉':'◌'}</button><button type="button" class="row-action more" data-action="more" title="گزینه‌های بیشتر" aria-label="گزینه‌های بیشتر">⋯</button></div>
        ${state.openMenu===item.id?`<div class="choice-menu"><button type="button" data-action="jump">↕ انتقال به شماره اولویت...</button><button type="button" data-action="duplicate">⊕ ساخت نسخه مشابه</button><button type="button" data-action="source">▧ مشاهده عکس اولیه</button><button type="button" data-action="toggle">${item.active?'⊘ غیرفعال کردن':'✓ فعال کردن'}</button><button type="button" data-action="remove" class="danger">✕ حذف انتخاب</button></div>`:''}
      </article>`;
    }).join('') : `<div class="empty-list"><div style="font-size:30px">⌕</div><h3>انتخابی پیدا نشد</h3><p>عبارت یا فیلتر را تغییر بده یا یک انتخاب تازه اضافه کن.</p><button class="btn btn-subtle" id="clearFiltersBtn" type="button">پاک کردن فیلترها</button></div>`;
    const clear=el('clearFiltersBtn');if(clear)clear.addEventListener('click',clearFilters);
    for(const t of document.querySelectorAll('.tab'))t.classList.toggle('active',t.dataset.category===state.category);
  }
  function clearFilters(){state.category='all';state.status='all';state.search='';el('searchInput').value='';el('statusSelect').value='all';render();}
  function moveTo(id,to){const arr=clone(state.items),old=arr.findIndex(x=>x.id===id);if(old<0)return;to=Math.max(0,Math.min(arr.length-1,Number(to)));if(!Number.isFinite(to)||old===to)return;const [item]=arr.splice(old,1);arr.splice(to,0,item);state.openMenu=null;commit(arr,`انتخاب به اولویت ${FA(to+1)} منتقل شد.`);}
  function moveBefore(id,targetId,after=false){const arr=clone(state.items);const from=arr.findIndex(x=>x.id===id);if(from===-1)return;const [item]=arr.splice(from,1);const target=arr.findIndex(x=>x.id===targetId);if(target===-1)return;arr.splice(target+(after?1:0),0,item);commit(arr,'ترتیب انتخاب‌ها تغییر کرد.');}
  function getItem(id){return state.items.find(x=>x.id===id);}
  function showModal(html,wide=false){
    closeModal();el('modalRoot').innerHTML=`<div class="modal-overlay" role="presentation"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-label="پنجره ابزار">${html}</section></div>`;
    const overlay=el('modalRoot').firstElementChild;
    overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.closest('[data-close-modal]'))closeModal();});
    const onKey=e=>{if(e.key==='Escape')closeModal();};document.addEventListener('keydown',onKey);
    modalCleanup=()=>document.removeEventListener('keydown',onKey);
    const input=overlay.querySelector('input:not([type="checkbox"]),textarea,button');if(input)input.focus();
  }
  function closeModal(){if(modalCleanup){modalCleanup();modalCleanup=null;}el('modalRoot').innerHTML='';}
  const head=(title)=>`<div class="modal-head"><h2>${title}</h2><button class="close-modal" type="button" data-close-modal aria-label="بستن">×</button></div>`;
  const foot=(submit='ذخیره تغییرات',other='انصراف')=>`<div class="modal-footer"><button class="btn btn-outline" type="button" data-close-modal>${other}</button><button class="btn btn-primary" type="submit">${submit}</button></div>`;

  function editItem(id=null,afterId=null){
    const item=id?getItem(id):{title:'',code:'',note:'',active:true,review:false};if(!item)return;
    const editing=!!id;
    showModal(`${head(editing?'ویرایش انتخاب':'افزودن انتخاب جدید')}<form id="itemForm"><div class="modal-body">
      <div class="form-grid"><div class="form-field full"><label for="editTitle">نام رشته، دوره و دانشگاه *</label><input id="editTitle" name="title" value="${escapeHtml(item.title)}" required maxlength="350" placeholder="مثلاً پزشکی شهریه‌پرداز شیراز (نیمسال اول)"></div>
      <div class="form-field"><label for="editCode">کدرشته</label><input id="editCode" name="code" value="${escapeHtml(item.code)}" inputmode="numeric" maxlength="25" placeholder="مثلاً ۳۲۹۸۹"><small>ارقام فارسی هم پذیرفته می‌شوند.</small></div>
      <div class="form-field"><label for="editStatus">وضعیت در خروجی</label><select id="editStatus" name="status"><option value="1" ${item.active?'selected':''}>فعال (در PDF بیاید)</option><option value="0" ${!item.active?'selected':''}>غیرفعال</option></select></div>
      <div class="form-field full"><label for="editNote">یادداشت شخصی (اختیاری)</label><textarea id="editNote" name="note" maxlength="1200" placeholder="مثلاً بررسی شهریه، ظرفیت یا شرایط بومی‌گزینی">${escapeHtml(item.note||'')}</textarea></div>
      <label class="check-row form-field full"><input name="review" type="checkbox" ${item.review?'checked':''}> این مورد هنوز نیاز به بررسی از روی عکس / دفترچه دارد.</label>
      </div></div>${foot(editing?'ثبت ویرایش':'افزودن به لیست')}</form>`);
    el('itemForm').addEventListener('submit',e=>{
      e.preventDefault();const f=new FormData(e.currentTarget);const title=String(f.get('title')).trim();if(!title)return;
      const update={title,code:normalCode(f.get('code')),note:String(f.get('note')||'').trim(),active:f.get('status')==='1',review:f.has('review')};
      const arr=clone(state.items);
      if(editing){const index=arr.findIndex(x=>x.id===id);if(index<0)return;Object.assign(arr[index],update);}
      else{const newItem={id:'custom-'+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)),...update,sourcePage:0,sourceRow:0};const pos=afterId?arr.findIndex(x=>x.id===afterId)+1:arr.length;arr.splice(pos,0,newItem);}
      closeModal();clearFilters();commit(arr,editing?'ویرایش ذخیره شد.':'انتخاب جدید اضافه شد.');
    });
  }
  function jumpDialog(id){const item=getItem(id),index=state.items.findIndex(x=>x.id===id);if(!item)return;
    showModal(`${head('انتقال به اولویت دلخواه')}<form id="jumpForm"><div class="modal-body"><div class="modal-note">«${escapeHtml(item.title)}» اکنون انتخاب شماره ${FA(index+1)} است. شماره مقصد را وارد کن؛ شماره بقیه انتخاب‌ها خودکار مرتب می‌شود.</div><div class="form-field"><label for="jumpNumber">شماره جدید (۱ تا ${FA(state.items.length)})</label><input id="jumpNumber" type="number" min="1" max="${state.items.length}" value="${index+1}" required></div></div>${foot('انتقال انتخاب')}</form>`);
    el('jumpForm').addEventListener('submit',e=>{e.preventDefault();const n=Number(el('jumpNumber').value);if(n<1||n>state.items.length)return;closeModal();clearFilters();moveTo(id,n-1);});
  }
  function sourceDialog(page){
    let current=pages.includes(page)?pages.indexOf(page):0;
    function contents(){return `${head('تصاویر دست‌نویس اولیه')}<div class="modal-body"><div class="modal-note">تصاویر فقط برای تطبیق داده‌ها نگهداری شده‌اند. روی تصویر کلیک کن تا بزرگ شود. ترتیب صفحات همان ترتیب انتخاب‌هاست.</div><div class="source-viewer"><img id="sourceImage" alt="تصویر شماره ${current+1} از فهرست دست‌نویس" src="assets/sources/${pages[current]}.jpg"></div><div class="source-controls"><button class="btn btn-outline" type="button" id="prevSource">→ صفحه قبل</button><span id="sourceIndex">تصویر ${FA(current+1)} از ${FA(pages.length)}</span><button class="btn btn-outline" type="button" id="nextSource">صفحه بعد ←</button></div></div>`;}
    showModal(contents(),true);
    function repaint(){el('sourceImage').src=`assets/sources/${pages[current]}.jpg`;el('sourceImage').classList.remove('zoomed');el('sourceIndex').textContent=`تصویر ${FA(current+1)} از ${FA(pages.length)}`;}
    el('prevSource').addEventListener('click',()=>{current=(current+pages.length-1)%pages.length;repaint();});
    el('nextSource').addEventListener('click',()=>{current=(current+1)%pages.length;repaint();});
    el('sourceImage').addEventListener('click',e=>e.currentTarget.classList.toggle('zoomed'));
  }
  function removeDialog(id){const item=getItem(id);if(!item)return;
    showModal(`${head('حذف انتخاب')}<div class="modal-body"><p>آیا «${escapeHtml(item.title)}» از فهرست حذف شود؟ می‌توانی با دکمه واگرد آن را بازیابی کنی.</p></div><div class="modal-footer"><button class="btn btn-outline" type="button" data-close-modal>انصراف</button><button class="btn btn-danger" type="button" id="confirmRemove">حذف انتخاب</button></div>`);
    el('confirmRemove').onclick=()=>{closeModal();state.openMenu=null;commit(state.items.filter(x=>x.id!==id),'انتخاب حذف شد.');};
  }
  function toggle(id){const arr=clone(state.items);const i=arr.findIndex(x=>x.id===id);if(i<0)return;arr[i].active=!arr[i].active;state.openMenu=null;commit(arr,arr[i].active?'انتخاب فعال شد.':'انتخاب غیرفعال شد.');}
  function duplicate(id){const item=getItem(id);if(!item)return;const arr=clone(state.items);const pos=arr.findIndex(x=>x.id===id);arr.splice(pos+1,0,{...clone(item),id:'custom-'+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)),sourcePage:0,sourceRow:0,review:true});state.openMenu=null;commit(arr,'یک نسخه مشابه ایجاد شد؛ لطفاً کدرشته را بررسی کنید.');}

  function downloadBlob(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);}
  function backup(){const payload={app:'olaviatchin',version:VERSION,exportedAt:new Date().toISOString(),items:state.items};downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),'olaviatchin-backup.json');notify('فایل پشتیبان دانلود شد.');}
  function csvExport(){const cols=['اولویت','کدرشته','عنوان انتخاب','فعال','نیازمند بازبینی','یادداشت'];const rows=[cols,...state.items.map((x,i)=>[i+1,x.code,x.title,x.active?'بله':'خیر',x.review?'بله':'خیر',x.note])];const csv='\ufeff'+rows.map(a=>a.map(v=>{const safe=String(v??'');return '"'+(/^[\s]*[=+@-]/.test(safe)?'\t'+safe:safe).replaceAll('"','""')+'"';}).join(',')).join('\r\n');downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8'}),'olaviatchin-selections.csv');notify('فایل CSV دانلود شد.');}
  function importJson(e){const file=e.target.files?.[0];e.target.value='';if(!file)return;if(file.size>3*1024*1024){notify('حجم فایل پشتیبان بیش از حد مجاز است.');return;}
    file.text().then(t=>{let data;try{data=JSON.parse(t);}catch{notify('فایل JSON معتبر نیست.');return;}
      if(data.app!=='olaviatchin'||data.version!==VERSION||!validItems(data.items)){notify('ساختار فایل پشتیبان با این برنامه سازگار نیست.');return;}
      showModal(`${head('بازیابی فایل پشتیبان')}<div class="modal-body"><p>تعداد ${FA(data.items.length)} انتخاب در فایل یافت شد. با بازیابی، فهرست فعلی جایگزین می‌شود. پیشنهاد می‌کنیم اول یک نسخه پشتیبان دانلود کنی.</p></div><div class="modal-footer"><button class="btn btn-outline" type="button" data-close-modal>انصراف</button><button class="btn btn-primary" id="confirmImport" type="button">بازیابی اطلاعات</button></div>`);
      el('confirmImport').onclick=()=>{closeModal();clearFilters();commit(data.items.map(cleanItem),'فایل پشتیبان بازیابی شد.');};
    }).catch(()=>notify('خواندن فایل ممکن نشد.'));
  }
  function resetDialog(){showModal(`${head('بازنشانی اطلاعات اولیه')}<div class="modal-body"><p>تمام تغییرهای این مرورگر با فهرست بازنویسی‌شده از عکس‌ها جایگزین می‌شود. پیش از ادامه حتماً فایل پشتیبان بگیر.</p></div><div class="modal-footer"><button class="btn btn-outline" type="button" data-close-modal>انصراف</button><button class="btn btn-danger" id="confirmReset" type="button">بازنشانی فهرست</button></div>`);
    el('confirmReset').onclick=()=>{closeModal();clearFilters();commit(clone(base),'فهرست اولیه بازیابی شد.');};
  }
  function pdfDialog(){
    const dup=getDuplicates();const missing=state.items.filter(x=>x.active&&!x.code).length;
    showModal(`${head('دریافت PDF انتخاب رشته')}<form id="pdfForm"><div class="modal-body"><div class="export-config">
      <div class="form-field"><label for="pdfTitle">عنوان بالای PDF</label><input id="pdfTitle" maxlength="75" value="فهرست اولویت‌های انتخاب رشته"></div>
      <div class="form-field"><label for="pdfName">نام داوطلب (اختیاری)</label><input id="pdfName" maxlength="70" placeholder="نام و نام خانوادگی"></div>
      <label class="check-row"><input id="pdfInactive" type="checkbox"> انتخاب‌های غیرفعال نیز در PDF بیایند.</label>
      <label class="check-row"><input id="pdfNotes" type="checkbox"> یادداشت‌های شخصی هم در PDF نمایش داده شوند.</label>
      <div class="export-preview"><strong id="pdfSummary">${FA(state.items.filter(x=>x.active).length)} انتخاب فعال</strong><span>خروجی در اندازه A4 با صفحه‌بندی خودکار و متن فارسی ساخته می‌شود.</span></div>
      <div class="small-secondary">${dup.size?`⚠ ${FA(dup.size)} کدرشته تکراری در میان انتخاب‌های فعال وجود دارد. `:''}${missing?`⚠ ${FA(missing)} انتخاب فعال بدون کد است. `:''}پیش از ثبت نهایی کدرشته‌ها را با دفترچه رسمی تطبیق بده.</div>
    </div></div>${foot('↓ ساخت و دانلود PDF')}</form>`);
    el('pdfInactive').onchange=()=>{el('pdfSummary').textContent=`${FA(state.items.filter(x=>x.active||el('pdfInactive').checked).length)} انتخاب برای PDF`;};
    el('pdfForm').addEventListener('submit',async e=>{
      e.preventDefault();const btn=e.currentTarget.querySelector('[type="submit"]');btn.disabled=true;btn.textContent='در حال ساخت PDF...';
      try{const result=await window.PdfExport.exportPdf({items:state.items,includeInactive:el('pdfInactive').checked,showNotes:el('pdfNotes').checked,title:el('pdfTitle').value.trim(),name:el('pdfName').value.trim()});downloadBlob(result.blob,'انتخاب-رشته-اولویت-چین.pdf');closeModal();notify(`PDF شامل ${FA(result.choiceCount)} انتخاب در ${FA(result.pageCount)} صفحه آماده شد.`);}catch(err){btn.disabled=false;btn.textContent='↓ ساخت و دانلود PDF';notify('ساخت PDF انجام نشد: '+err.message);console.error(err);}
    });
  }
  function helpDialog(){showModal(`${head('راهنمای اولویت‌چین')}<div class="modal-body"><ol class="help-steps"><li><b>مرتب کردن اولویت‌ها</b><span>دستگیره ⠿ را با موس یا لمس بکش. در موبایل و دسکتاپ کار می‌کند. یا از منوی ⋯ «انتقال به شماره» را بزن. برای کشیدن، جستجو و فیلتر باید خالی باشند.</span></li><li><b>تغییر عنوان و کدرشته</b><span>از دکمه ✎ هر ردیف، عنوان، کد، یادداشت و وضعیت را اصلاح کن.</span></li><li><b>بازبینی از روی عکس‌ها</b><span>روی «دیدن» زیر ردیف بزن تا عکس دست‌نویس مربوطه باز شود. اطلاعات بازنویسی‌شده الزاماً با دفترچه سنجش یکی نیست.</span></li><li><b>ذخیره، انتقال و خروجی</b><span>تغییرها خودکار در همین مرورگر می‌مانند. برای انتقال به گوشی یا مرورگر دیگر، پشتیبان JSON بگیر. دکمه PDF مستقیماً فایل چاپی دانلود می‌کند؛ «چاپ / PDF متنی» هم برای PDF قابل جستجو در مرورگر موجود است.</span></li></ol></div><div class="modal-footer"><button class="btn btn-primary" type="button" data-close-modal>متوجه شدم</button></div>`);}

  el('choices').addEventListener('click',e=>{
    const btn=e.target.closest('[data-action]');if(!btn)return;
    const row=btn.closest('.choice');if(!row)return;const id=row.dataset.id;const item=getItem(id);
    switch(btn.dataset.action){
      case 'edit':editItem(id);break;
      case 'toggle':toggle(id);break;
      case 'source':sourceDialog(item?.sourcePage||1);break;
      case 'more':state.openMenu=state.openMenu===id?null:id;render();break;
      case 'jump':state.openMenu=null;jumpDialog(id);break;
      case 'duplicate':duplicate(id);break;
      case 'remove':state.openMenu=null;removeDialog(id);break;
    }
  });
  // Pointer-based sorting: supports mouse, touch and pen without external dependencies.
  el('choices').addEventListener('pointerdown',e=>{
    const handle=e.target.closest('.grip');if(!handle||handle.disabled||e.button!==0)return;
    const row=handle.closest('.choice');if(!row)return;
    e.preventDefault(); const item=getItem(row.dataset.id);if(!item)return;
    drag={id:item.id,startX:e.clientX,startY:e.clientY,currentX:e.clientX,currentY:e.clientY,targetId:null,after:false,active:false,ghost:null,pointerId:e.pointerId};
    handle.setPointerCapture(e.pointerId);
    handle.addEventListener('pointermove',dragMove);
    handle.addEventListener('pointerup',dragEnd,{once:true});
    handle.addEventListener('pointercancel',dragCancel,{once:true});
  });
  function dragMove(e){
    if(!drag||e.pointerId!==drag.pointerId)return;
    drag.currentX=e.clientX;drag.currentY=e.clientY;
    if(!drag.active&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>6){drag.active=true;const g=document.createElement('div');g.className='drag-ghost';g.textContent=getItem(drag.id)?.title||'انتخاب';document.body.append(g);drag.ghost=g;el('choices').querySelector(`[data-id="${drag.id}"]`)?.classList.add('dragging');}
    if(!drag.active)return;
    drag.ghost.style.top=(e.clientY+13)+'px';drag.ghost.style.left=Math.max(6,Math.min(innerWidth-470,e.clientX-130))+'px';
    const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.choice');
    el('choices').querySelectorAll('.drop-target').forEach(x=>x.classList.remove('drop-target'));
    if(target&&target.dataset.id!==drag.id){drag.targetId=target.dataset.id;drag.after=e.clientY>target.getBoundingClientRect().top+target.getBoundingClientRect().height/2;target.classList.add('drop-target');target.classList.toggle('bottom',drag.after);}else drag.targetId=null;
    if(e.clientY<100)window.scrollBy(0,-24);else if(e.clientY>innerHeight-90)window.scrollBy(0,24);
  }
  function cleanDrag(){if(!drag)return;drag.ghost?.remove();el('choices').querySelectorAll('.drop-target,.dragging').forEach(x=>x.classList.remove('drop-target','dragging'));drag=null;}
  function dragEnd(e){if(!drag||e.pointerId!==drag.pointerId)return;const target=drag.targetId,id=drag.id,after=drag.after,active=drag.active;const h=e.currentTarget;h.removeEventListener('pointermove',dragMove);cleanDrag();if(active&&target)moveBefore(id,target,after);}
  function dragCancel(e){e.currentTarget.removeEventListener('pointermove',dragMove);cleanDrag();}
  el('choices').addEventListener('keydown',e=>{if(!e.altKey||!['ArrowUp','ArrowDown'].includes(e.key))return;const grip=e.target.closest('.grip');if(!grip||grip.disabled)return;e.preventDefault();const id=grip.closest('.choice').dataset.id,idx=state.items.findIndex(x=>x.id===id);moveTo(id,idx+(e.key==='ArrowUp'?-1:1));});

  el('searchInput').addEventListener('input',e=>{state.search=e.target.value;state.openMenu=null;render();});
  el('statusSelect').addEventListener('change',e=>{state.status=e.target.value;state.openMenu=null;render();});
  el('categoryTabs').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(!b)return;state.category=b.dataset.category;state.openMenu=null;render();});
  el('addTopBtn').onclick=el('addBtn').onclick=el('bottomAddBtn').onclick=()=>editItem();
  el('undoBtn').onclick=undo;el('redoBtn').onclick=redo;
  el('exportBtn').onclick=pdfDialog;el('exportJsonBtn').onclick=el('backupBtn').onclick=backup;
  el('exportCsvBtn').onclick=csvExport;
  el('importBtn').onclick=()=>el('importFile').click();el('importFile').addEventListener('change',importJson);
  el('resetBtn').onclick=resetDialog;el('printBtn').onclick=()=>{
    const filters={category:state.category,status:state.status,search:state.search};
    clearFilters();state.openMenu=null;render();
    window.addEventListener('afterprint',()=>{state.category=filters.category;state.status=filters.status;state.search=filters.search;el('searchInput').value=filters.search;el('statusSelect').value=filters.status;render();},{once:true});
    window.print();
  };
  el('sourceTopBtn').onclick=()=>sourceDialog(1);el('reviewBtn').onclick=()=>{state.category='all';state.status='review';state.search='';el('searchInput').value='';el('statusSelect').value='review';render();el('workspace').scrollIntoView({behavior:'smooth'});};
  el('helpBtn').onclick=helpDialog;
  document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,[contenteditable]'))return;if(e.key==='/'&&!el('modalRoot').children.length){e.preventDefault();el('searchInput').focus();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}});
  window.addEventListener('storage',event=>{if(event.key!==STORAGE_KEY)return;const fresh=load();state.items=fresh;state.undo.length=0;state.redo.length=0;render();notify('تغییرهای تب دیگر همگام شد.');});
  render();
  window.__appTest={state,category,normalCode,validItems,moveTo,clearFilters};
})();
