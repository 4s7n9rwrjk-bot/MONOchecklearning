/* Excel-like remaining-pages line chart and completion doughnut; no external library. */
(function(){
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const asDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T00:00:00Z') : null;
  const fmtDate = value => value.slice(5).replace('-', '/');
  const BLUE = '#4472c4';
  const ORANGE = '#ed7d31';

  // One source of truth for the bar and the doughnut.
  window.calcProgress = function(subject){
    const totalPages = Math.max(0, Number(subject.totalPages) || (Array.isArray(subject.contents) ? subject.contents.reduce((sum,c) => sum + Math.max(0, Number(c.end)-Number(c.start)+1), 0) : 0));
    const actualPages = Object.values(subject.actuals && typeof subject.actuals === 'object' ? subject.actuals : {}).reduce((sum,value) => sum + Math.max(0, Number(value) || 0), 0);
    const completedPages = Math.min(totalPages, actualPages);
    const percent = totalPages ? Math.max(0, Math.min(100, Math.round(completedPages / totalPages * 100))) : 0;
    return {totalPages, actualPages, completedPages, remainingPages:Math.max(0,totalPages-completedPages), percent, ratio:percent/100};
  };

  // 進捗率バーと円グラフ（ドーナツ）は必ず同じ数値を使う。共通の入口をここに一本化する。
  window.progressPercent = function(subject){
    return window.calcProgress(subject).percent;
  };
  window.progressPercentText = function(subject){
    return window.progressPercent(subject) + '%';
  };

  window.renderProgressChart = function(subject){
    const main = document.getElementById('main');
    if (!main) return;
    const schedule = Array.isArray(subject.schedule) ? subject.schedule : [];
    const actuals = subject.actuals && typeof subject.actuals === 'object' ? subject.actuals : {};
    const progress = window.calcProgress(subject);
    const total = progress.totalPages;
    const plannedByDate = Object.create(null);
    schedule.forEach(row => {
      if (!row || !asDate(String(row.date || ''))) return;
      const day = String(row.date);
      plannedByDate[day] = (plannedByDate[day] || 0) + Math.max(0, Number(row.planned) || 0);
    });
    const actualByDate = Object.create(null);
    Object.entries(actuals).forEach(([day, value]) => {
      if (asDate(day)) actualByDate[day] = Math.max(0, Number(value) || 0);
    });
    const allDates = [...new Set([...Object.keys(plannedByDate), ...Object.keys(actualByDate)])].sort();
    const actualTotal = progress.actualPages;
    const completed = progress.completedPages;
    // 数値の出所を一本化：進捗率バーとまったく同じ window.progressPercent() を使う
    const percent = window.progressPercent(subject);
    const ratio = percent / 100;

    // Separate chart cards to mirror the workbook's trend line + progress doughnut.
    const charts = document.createElement('div');
    charts.className = 'grid';
    charts.style.marginTop = '14px';
    const lineCard = document.createElement('section');
    lineCard.className = 'card span8';
    lineCard.setAttribute('aria-label', '予定と実績の残りページ推移');
    lineCard.innerHTML = '<div class="h">📉 残りページの推移</div><div class="muted" style="margin:-4px 0 12px">予定どおりに進んだ場合と、実際の読書後に残るページ数を比較します。</div><div data-remaining-chart></div>';
    const donutCard = document.createElement('section');
    donutCard.className = 'card span4';
    donutCard.setAttribute('aria-label', '教材全体の実績進捗率');
    donutCard.innerHTML = `<div class="h">🎯 実績進捗率</div><div class="muted" style="margin:-4px 0 8px">実際に読んだページ／教材総ページ（進捗率バーと同値）</div><div data-progress-doughnut></div>`;
    charts.appendChild(lineCard);
    charts.appendChild(donutCard);
    main.appendChild(charts);

    const lineHost = lineCard.querySelector('[data-remaining-chart]');
    if (!allDates.length) {
      lineHost.innerHTML = '<div class="item muted">日別の予定または実績を登録すると、残りページの折れ線グラフが表示されます。</div>';
    } else {
      // Add a starting baseline one day before the first planned/actual record,
      // then include every intervening day as a calendar-date category.
      const firstRecord = asDate(allDates[0]);
      const lastRecord = asDate(allDates[allDates.length - 1]);
      const first = new Date(firstRecord.getTime() - 86400000);
      const dayCount = Math.floor((lastRecord - first) / 86400000) + 1;
      const dates = [];
      if (dayCount > 0 && dayCount <= 3661) {
        for (let i = 0; i < dayCount; i++) dates.push(new Date(first.getTime() + i * 86400000).toISOString().slice(0,10));
      } else {
        dates.push(first.toISOString().slice(0,10), ...allDates);
      }
      let plannedDone = 0, actualDone = 0;
      const points = dates.map((day, i) => {
        if (i > 0) {
          plannedDone += plannedByDate[day] || 0;
          actualDone += actualByDate[day] || 0;
        }
        return {day, plannedRemaining:Math.max(0,total-plannedDone), actualRemaining:Math.max(0,total-actualDone)};
      });
      const maxValue = Math.max(1, total, ...points.map(point => Math.max(point.plannedRemaining,point.actualRemaining)));
      const tickStep = Math.max(1, Math.ceil(maxValue / 4));
      const axisMax = tickStep * 4;
      const W = 760, H = 292, L = 58, R = 18, T = 18, B = 48;
      const plotW = W-L-R, plotH = H-T-B;
      const x = i => points.length === 1 ? L+plotW/2 : L+i*plotW/(points.length-1);
      const y = value => T+plotH-value/axisMax*plotH;
      let grid = '';
      for (let i=0;i<=4;i++) {
        const value=tickStep*i, yy=y(value);
        grid += `<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#e8edf4"/><text x="${L-9}" y="${yy+4}" text-anchor="end" fill="#667085" font-size="11">${value}</text>`;
      }
      const labelCount=Math.min(6,points.length), labels=[];
      for(let i=0;i<labelCount;i++) {
        const index=labelCount===1?0:Math.round(i*(points.length-1)/(labelCount-1));
        labels.push(`<text x="${x(index)}" y="${H-16}" text-anchor="middle" fill="#667085" font-size="11">${esc(fmtDate(points[index].day))}</text>`);
      }
      const plannedPoints=points.map((point,i)=>`${x(i)},${y(point.plannedRemaining)}`).join(' ');
      const actualPoints=points.map((point,i)=>`${x(i)},${y(point.actualRemaining)}`).join(' ');
      const dots=points.map((point,i)=>{
        const title=`${point.day}｜予定残り ${point.plannedRemaining}p｜実績残り ${point.actualRemaining}p`;
        const radius=points.length<=45?2.6:1.6;
        return `<circle cx="${x(i)}" cy="${y(point.plannedRemaining)}" r="${radius}" fill="${BLUE}"><title>${esc(title)}</title></circle><circle cx="${x(i)}" cy="${y(point.actualRemaining)}" r="${radius}" fill="${ORANGE}"><title>${esc(title)}</title></circle>`;
      }).join('');
      const latest=points[points.length-1];
      lineHost.innerHTML=`<div style="display:flex;gap:16px;flex-wrap:wrap;margin:0 0 8px;font-size:12px;font-weight:700"><span style="color:${BLUE}">● 予定残りページ</span><span style="color:${ORANGE}">● 実績残りページ</span><span class="muted" style="font-weight:400">単位：ページ</span></div><div style="width:100%;overflow-x:auto"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="予定残りページと実績残りページの折れ線グラフ" style="display:block;width:100%;min-width:520px;height:auto;font-family:system-ui,-apple-system,'Segoe UI','Noto Sans JP',sans-serif"><text x="14" y="${T+plotH/2}" transform="rotate(-90 14 ${T+plotH/2})" text-anchor="middle" fill="#667085" font-size="11">残りページ</text>${grid}<line x1="${L}" y1="${T}" x2="${L}" y2="${T+plotH}" stroke="#cbd5e1"/><line x1="${L}" y1="${T+plotH}" x2="${W-R}" y2="${T+plotH}" stroke="#cbd5e1"/><polyline points="${plannedPoints}" fill="none" stroke="${BLUE}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><polyline points="${actualPoints}" fill="none" stroke="${ORANGE}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${dots}${labels.join('')}</svg></div><div class="small" style="margin-top:6px">現在の予定残り ${latest.plannedRemaining}p　／　実績残り ${latest.actualRemaining}p</div>`;
    }

    const size=210, center=size/2, radius=64, circumference=2*Math.PI*radius;
    const donutSvg=`<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="実績進捗 ${percent}パーセント" style="display:block;width:min(100%,240px);height:auto;margin:0 auto;font-family:system-ui,-apple-system,'Segoe UI','Noto Sans JP',sans-serif"><circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#edf0f5" stroke-width="22"/><circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${BLUE}" stroke-width="22" stroke-dasharray="${circumference*ratio} ${circumference}" transform="rotate(-90 ${center} ${center})" stroke-linecap="round"/><text x="${center}" y="${center-1}" text-anchor="middle" dominant-baseline="middle" font-size="32" font-weight="900" fill="#172033">${window.progressPercentText(subject)}</text><text x="${center}" y="${center+25}" text-anchor="middle" fill="#667085" font-size="12">実績進捗率</text></svg>`;
    donutCard.querySelector('[data-progress-doughnut]').innerHTML=`${donutSvg}<div style="text-align:center;font-size:13px;font-weight:800;margin-top:2px">${completed} / ${total} ページ</div><div class="muted" style="text-align:center;margin-top:3px">残り ${progress.remainingPages} ページ</div>`;
  };
})();
