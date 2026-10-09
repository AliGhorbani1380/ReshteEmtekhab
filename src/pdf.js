/* خروجی PDF کاملاً محلی و بدون وابستگی خارجی؛ متن فارسی با Canvas مرورگر رسم می‌شود. */
(function () {
  'use strict';
  const W = 1400, H = 1980, PAGE_W = 595.28, PAGE_H = 841.89;
  const nfa = number => Number(number).toLocaleString('fa-IR');
  const encoder = new TextEncoder();

  function wrappedLines(ctx, value, maxWidth) {
    const text = String(value ?? '').trim();
    if (!text) return ['—'];
    const words = text.split(/\s+/);
    const lines = []; let current = '';
    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      if (ctx.measureText(test).width <= maxWidth || !current) current = test;
      else { lines.push(current); current = word; }
    }
    if (current) lines.push(current);
    return lines;
  }

  function makePage(context) {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.direction = 'rtl'; ctx.textAlign = 'right';
    ctx.fillStyle = '#14213c'; ctx.fillRect(0, 0, W, 19);
    ctx.fillStyle = '#13213b'; ctx.font = 'bold 47px Tahoma, Arial, sans-serif';
    ctx.fillText(context.title, W - 88, 116);
    ctx.font = '25px Tahoma, Arial, sans-serif';ctx.fillStyle='#69768b';
    ctx.fillText(context.name ? 'نام داوطلب: ' + context.name : 'فهرست شخصی اولویت‌های انتخاب رشته', W - 88, 167);
    ctx.textAlign = 'left';ctx.direction='ltr';ctx.fillText(context.date, 88, 166);
    ctx.fillStyle='#e9edf6';ctx.fillRect(88, 194, W-176, 3);
    ctx.direction = 'rtl';ctx.textAlign='right';
    ctx.fillStyle = '#f2f5fb'; ctx.fillRect(88, 215, W-176, 62);
    ctx.font = 'bold 26px Tahoma, Arial, sans-serif';ctx.fillStyle = '#384c6d';
    ctx.fillText('ردیف', W - 108, 255);
    ctx.fillText('رشته / دوره / محل', W - 270, 255);
    ctx.fillText('کدرشته', 305, 255);
    ctx.fillStyle='#e2e8f1';ctx.fillRect(88, 276, W-176, 2);
    return {ctx,canvas,y:291,lines:0};
  }

  function drawRow(page, item, index, showNotes) {
    const ctx = page.ctx;
    const titleX = W - 270;
    const maxTitleWidth = titleX - 358;
    ctx.font = '27px Tahoma, Arial, sans-serif';
    const titleLines = wrappedLines(ctx, item.title, maxTitleWidth);
    const noteLines = showNotes && item.note ? wrappedLines(ctx, item.note, maxTitleWidth) : [];
    const height = Math.max(65, 21 + titleLines.length * 38 + noteLines.length * 29);
    if (page.y + height > H - 126) return false;
    if (index % 2 === 1) {ctx.fillStyle='#f9fbfd';ctx.fillRect(88,page.y,W-176,height);}
    if (!item.active) {ctx.fillStyle='#fff8ec';ctx.fillRect(88,page.y,W-176,height);}
    ctx.direction='rtl';ctx.textAlign='right';
    ctx.font='bold 25px Tahoma, Arial, sans-serif';ctx.fillStyle='#576783';
    ctx.fillText(nfa(index + 1), W - 116, page.y + 42);
    ctx.fillStyle=item.active?'#1f2c45':'#9f7847';ctx.font='27px Tahoma, Arial, sans-serif';
    for (let n=0;n<titleLines.length;n++) ctx.fillText(titleLines[n],titleX,page.y+39+n*38);
    if (noteLines.length) {
      ctx.font='20px Tahoma, Arial, sans-serif';ctx.fillStyle='#7b8aa1';
      for (let n=0;n<noteLines.length;n++) ctx.fillText(noteLines[n],titleX,page.y+36+titleLines.length*38+n*29);
    }
    ctx.direction='ltr';ctx.textAlign='center';ctx.fillStyle='#253859';ctx.font='bold 28px Arial, sans-serif';
    ctx.fillText(item.code||'—',202,page.y+41);
    ctx.strokeStyle='#e6eaf1';ctx.beginPath();ctx.moveTo(88,page.y+height);ctx.lineTo(W-88,page.y+height);ctx.stroke();
    page.y+=height;page.lines++;
    return true;
  }

  function finishPage(page, number, total, count) {
    const ctx=page.ctx;
    ctx.fillStyle='#e5eaf3';ctx.fillRect(88,H-104,W-176,2);
    ctx.font='22px Tahoma, Arial, sans-serif';ctx.fillStyle='#79879f';ctx.textAlign='right';ctx.direction='rtl';
    ctx.fillText(`مجموع ${nfa(count)} انتخاب • تنظیم‌شده در اولویت‌چین`,W-88,H-58);
    ctx.textAlign='left';ctx.direction='ltr';ctx.fillText(`${number} / ${total}`,88,H-58);
  }

  function toJpeg(canvas) {
    const raw=atob(canvas.toDataURL('image/jpeg',0.86).split(',')[1]);
    const arr=new Uint8Array(raw.length);
    for(let k=0;k<raw.length;k++) arr[k]=raw.charCodeAt(k);
    return arr;
  }

  // PDF 1.4 writer with JPEG pages (Persian glyph shaping is done by browser).
  function encodePdf(images) {
    const offsets = []; const parts=[]; let position=0;
    const append = bytes => {parts.push(bytes);position += bytes.length;};
    const str = text => append(encoder.encode(text));
    const obj = (id, writeContent) => {
      offsets[id]=position;str(id+' 0 obj\n');writeContent();str('\nendobj\n');
    };
    str('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1,()=>str('<< /Type /Catalog /Pages 2 0 R >>'));
    const kids=images.map((_,i)=>`${3+i*3} 0 R`).join(' ');
    obj(2,()=>str(`<< /Type /Pages /Kids [ ${kids} ] /Count ${images.length} >>`));
    images.forEach((bytes,index)=>{
      const page=3+index*3, picture=page+1, content=page+2;
      obj(page,()=>str(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /XObject << /Im0 ${picture} 0 R >> >> /Contents ${content} 0 R >>`));
      obj(picture,()=>{str(`<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);append(bytes);str('\nendstream');});
      const operators=`q\n${PAGE_W} 0 0 ${PAGE_H} 0 0 cm\n/Im0 Do\nQ\n`;
      obj(content,()=>str(`<< /Length ${encoder.encode(operators).length} >>\nstream\n${operators}endstream`));
    });
    const xref=position;
    str(`xref\n0 ${images.length*3+3}\n0000000000 65535 f \n`);
    for(let id=1;id<=images.length*3+2;id++) str(String(offsets[id]).padStart(10,'0')+' 00000 n \n');
    str(`trailer\n<< /Size ${images.length*3+3} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(parts,{type:'application/pdf'});
  }

  async function exportPdf(options) {
    const items=options.items.filter(x=>options.includeInactive||x.active);
    if(!items.length) throw Error('هیچ انتخابی برای خروجی وجود ندارد.');
    const pageContext={title:options.title||'فهرست اولویت‌های انتخاب رشته',name:options.name||'',date:new Date().toLocaleDateString('fa-IR')};
    const pages=[];let page=makePage(pageContext);
    items.forEach((item,index)=>{
      if(!drawRow(page,item,index,options.showNotes)) {pages.push(page);page=makePage(pageContext);drawRow(page,item,index,options.showNotes);}
    });
    pages.push(page);
    const jpeg=[];
    for(let i=0;i<pages.length;i++){
      finishPage(pages[i],i+1,pages.length,items.length);
      jpeg.push(toJpeg(pages[i].canvas));
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    return {blob:encodePdf(jpeg),pageCount:pages.length,choiceCount:items.length};
  }

  window.PdfExport={exportPdf,encodePdf};
})();
