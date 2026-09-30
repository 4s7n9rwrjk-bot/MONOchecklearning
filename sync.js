(function(){
let client=null,user=null,busy=false,timer=null,initPromise=null,pendingSync=false;
let viewerToken=localStorage.getItem('monocheck-viewer-token')||'';
let viewerTimer=null;
const SUPA_URL_KEYS=['MONOCHECK_STUDY_SUPABASE_URL','MONOCHECK_SUPABASE_URL'];
const SUPA_KEY_KEYS=['MONOCHECK_STUDY_SUPABASE_ANON_KEY','MONOCHECK_SUPABASE_ANON_KEY','MONOCHECK_SUPABASE_PUBLISHABLE_KEY'];

function cfg(){
  let url=SUPA_URL_KEYS.map(k=>window[k]).find(Boolean);
  let key=SUPA_KEY_KEYS.map(k=>window[k]).find(Boolean);
  return !!(url&&key&&window.supabase);
}
function getCfg(){
  return {url:SUPA_URL_KEYS.map(k=>window[k]).find(Boolean)||'',key:SUPA_KEY_KEYS.map(k=>window[k]).find(Boolean)||''};
}
function msg(t){let e=document.getElementById('syncMessage');if(e)e.textContent=t;}
function status(t){
  let e=document.getElementById('syncStatus');if(e)e.textContent=t;
  let d=document.getElementById('syncDot');if(d)d.textContent=user?'●':'○';
}
function localStamp(){return Number(localStorage.getItem('monocheck-study-updated')||0);}
const CAT_LS_KEY='monocheck-calendar-categories-v1';
const CAT_UPDATED_KEY='monocheck-calendar-categories-updated';
const CAT_AUTH_KEY='monocheck-calendar-categories-authoritative-v3';
const CAT_AUTH_UPDATED_KEY='monocheck-calendar-categories-authoritative-updated-v3';
function mergeLocalCategoriesIntoData(target){
  try{
    const raw=localStorage.getItem(CAT_AUTH_KEY)||localStorage.getItem(CAT_LS_KEY); if(!raw)return target;
    const cats=JSON.parse(raw); if(!cats||typeof cats!=='object'||Array.isArray(cats))return target;
    target=target&&typeof target==='object'?target:{};
    const localUpdated=Number(localStorage.getItem(CAT_AUTH_UPDATED_KEY)||localStorage.getItem(CAT_UPDATED_KEY)||0);
    const dataUpdated=Number(target.calendarCategoriesUpdatedAt||0);
    if(localUpdated>=dataUpdated){target.calendarCategories=cats;target.calendarCategoriesUpdatedAt=localUpdated;}
  }catch(e){}
  return target;
}

async function waitForSupabase(){
  if(window.supabase)return true;
  for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,150));if(window.supabase)return true;}
  return false;
}
async function ensureClient(){
  if(client)return client;
  if(initPromise)return initPromise;
  initPromise=(async()=>{
    await waitForSupabase();
    if(!cfg())throw new Error('Supabase設定が読み込めていません。supabase-config.js のURLとPublishable keyを確認してください。');
    let c=getCfg();
    client=window.supabase.createClient(c.url,c.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage,storageKey:'monocheck-study-auth',flowType:'pkce'}});
    let s=await client.auth.getSession();
    user=s.data?.session?.user||null;
    client.auth.onAuthStateChange((_e,session)=>{
      user=session?.user||null;
      if(user){status('本人ログイン継続・同期中…');setTimeout(()=>syncNow(false),0);}else if(!window.__monoViewerMode){status('未ログイン');}
    });
    if(user)await syncNow(false);else status(window.__monoViewerMode?'閲覧モード':'未ログイン');
    return client;
  })().catch(e=>{client=null;status('同期設定エラー');msg(e.message||String(e));throw e;}).finally(()=>{initPromise=null;});
  return initPromise;
}

function setViewerUi(on){
  window.__monoViewerMode=!!on;
  document.body.classList.toggle('viewer-mode',!!on);
  const exit=document.getElementById('viewerExitBtn');if(exit)exit.style.display=on?'inline-block':'none';
  const viewerFields=document.getElementById('viewerFields');if(viewerFields)viewerFields.style.display=on?'none':'';
  const syncEmail=document.getElementById('syncEmail');if(syncEmail)syncEmail.disabled=on;
  const syncPassword=document.getElementById('syncPassword');if(syncPassword)syncPassword.disabled=on;
  if(window.__monoCalendarRefresh)window.__monoCalendarRefresh();
  if(on){
    status('👁 閲覧モード');
    startViewerPolling();
  }else{
    stopViewerPolling();
  }
}
function applyViewerData(payload,initial){
  if(!payload||!payload.data)return false;
  data=payload.data;
  localStorage.setItem(KEY,JSON.stringify(data));
  const stamp=payload.updated_at?Date.parse(payload.updated_at):Date.now();
  localStorage.setItem('monocheck-viewer-updated',String(stamp));
  if(!initial && typeof render==='function')render();
  if(window.__monoCalendarRefresh)window.__monoCalendarRefresh();
  return true;
}
async function viewerFetch(){
  if(!viewerToken)return false;
  await ensureClient();
  const {data:r,error}=await client.rpc('monocheck_viewer_get_data',{p_token:viewerToken});
  if(error)throw error;
  return applyViewerData(r,false);
}
function startViewerPolling(){
  stopViewerPolling();
  viewerTimer=setInterval(()=>{viewerFetch().catch(e=>{console.warn('viewer refresh',e);if(/無効|期限切れ|invalid|expired/i.test(e.message||''))viewerSignOut();});},10000);
}
function stopViewerPolling(){if(viewerTimer){clearInterval(viewerTimer);viewerTimer=null;}}

window.openSyncModal=function(){
  let m=document.getElementById('syncModal');if(m)m.style.display='flex';
  if(window.__monoViewerMode){status('👁 閲覧モードで表示中');msg('家族用の閲覧専用画面です。本人の変更は自動で反映されます。');return;}
  if(!cfg()){status('Supabase未設定：端末内保存のみ');msg('supabase-config.js のURLとPublishable keyを確認してください。');}
  else if(user){status('本人ログイン済み。閲覧IDを設定できます。');ensureClient().catch(()=>{});}
  else{status('本人ログインまたは閲覧してください');ensureClient().catch(()=>{});}
};
window.closeSyncModal=function(){let m=document.getElementById('syncModal');if(m)m.style.display='none';};

window.syncSignUp=async function(){
  try{
    if(window.__monoViewerMode)return;
    await ensureClient();
    let email=document.getElementById('syncEmail').value.trim();
    let password=document.getElementById('syncPassword').value;
    if(!email||password.length<6)return msg('メールアドレスと6文字以上のパスワードを入力してください');
    let {error}=await client.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin}});
    if(error)throw error;
    msg('登録しました。メール確認が必要な設定なら確認後にログインしてください。');
  }catch(e){console.error(e);msg(e.message||String(e));}
};
window.syncSignIn=async function(){
  try{
    if(window.__monoViewerMode)return;
    await ensureClient();
    let email=document.getElementById('syncEmail').value.trim();
    let password=document.getElementById('syncPassword').value;
    if(!email||password.length<6)return msg('メールアドレスと6文字以上のパスワードを入力してください');
    let {error}=await client.auth.signInWithPassword({email,password});
    if(error)throw error;
    msg('本人ログインしました。同期します…');
    await syncNow(false);
  }catch(e){console.error(e);msg(e.message||String(e));}
};
window.setViewerCredentials=async function(){
  try{
    if(!user)return msg('まず本人ログインしてください');
    let id=(document.getElementById('viewerId')?.value||'').trim();
    let pw=document.getElementById('viewerPassword')?.value||'';
    if(id.length<3||id.length>40||!/^[A-Za-z0-9_-]+$/.test(id))return msg('閲覧IDは3〜40文字の英数字・_・-で入力してください');
    if(pw.length<6)return msg('閲覧パスワードは6文字以上にしてください');
    let {error}=await client.rpc('monocheck_viewer_set_credentials',{p_viewer_id:id,p_password:pw});
    if(error)throw error;
    msg('閲覧ID・パスワードを設定しました。家族は「閲覧する」から入れます。');
  }catch(e){console.error(e);msg(e.message||String(e));}
};
window.disableViewerAccess=async function(){
  try{
    if(!user)return msg('まず本人ログインしてください');
    let {error}=await client.rpc('monocheck_viewer_disable');if(error)throw error;
    msg('閲覧アクセスを停止しました。');
  }catch(e){console.error(e);msg(e.message||String(e));}
};
window.viewerSignIn=async function(){
  try{
    await ensureClient();
    let id=(document.getElementById('viewerId')?.value||'').trim();
    let pw=document.getElementById('viewerPassword')?.value||'';
    if(!id||!pw)return msg('閲覧IDと閲覧パスワードを入力してください');
    let {data:r,error}=await client.rpc('monocheck_viewer_login',{p_viewer_id:id,p_password:pw});
    if(error)throw error;
    if(!r?.token||!r?.data)throw new Error('閲覧データを取得できませんでした');
    viewerToken=r.token;
    localStorage.setItem('monocheck-viewer-token',viewerToken);
    applyViewerData(r,true);
    setViewerUi(true);
    msg('閲覧モードでログインしました。');
    closeSyncModal();
    render();
  }catch(e){console.error(e);msg(e.message||String(e));}
};
window.viewerSignOut=async function(){
  try{if(client&&viewerToken)await client.rpc('monocheck_viewer_logout',{p_token:viewerToken});}catch(e){console.warn(e);}
  viewerToken='';localStorage.removeItem('monocheck-viewer-token');setViewerUi(false);status(user?'本人ログイン済み':'未ログイン');msg('閲覧モードを終了しました。');
};
window.syncSignOut=async function(){
  try{if(client)await client.auth.signOut();}catch(e){console.error(e);}finally{user=null;status('ログアウトしました');}
};

window.syncNow=async function(){
  if(window.__monoViewerMode)return viewerFetch().catch(e=>msg(e.message||String(e)));
  if(!client||!user)return msg('Supabaseに本人ログインしてください');
  if(busy){pendingSync=true;return;}
  busy=true;status('同期中…');
  try{
    try{if(typeof window.catDiagWrite==='function')window.catDiagWrite('syncNow:開始',{dataCats:window.cloneCats?window.cloneCats(data.calendarCategories):data.calendarCategories,localCat:localStorage.getItem(CAT_LS_KEY),localUpdated:localStorage.getItem(CAT_UPDATED_KEY)});}catch(_){}
    let {data:r,error:e}=await client.from('monocheck_study_data').select('data,updated_at').eq('user_id',user.id).maybeSingle();
    if(e)throw e;
    data=mergeLocalCategoriesIntoData(data);
    try{if(typeof window.catDiagWrite==='function')window.catDiagWrite('syncNow:mergeLocalCategoriesIntoData後',{dataCats:data.calendarCategories,dataUpdated:data.calendarCategoriesUpdatedAt});}catch(_){}
    let ls=localStamp(),remote=r?.updated_at?Date.parse(r.updated_at):0;
    if(!r)await push();
    else if(ls>remote)await push();
    else if(remote>ls){
      const remoteData=r.data||{};
      // カテゴリは学習データ全体とは別の更新日時で競合解決する。
      const localCatRaw=localStorage.getItem(CAT_AUTH_KEY)||localStorage.getItem(CAT_LS_KEY);
      const localCatUpdated=Number(localStorage.getItem(CAT_AUTH_UPDATED_KEY)||localStorage.getItem(CAT_UPDATED_KEY)||0);
      const remoteCatUpdated=Number(remoteData.calendarCategoriesUpdatedAt||0);
      let localCats=null;
      if(localCatRaw){
        try{
          const parsed=JSON.parse(localCatRaw);
          if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)) localCats=parsed;
        }catch(e){}
      }
      const categoryLocalIsNewer=!!localCats && localCatUpdated>=remoteCatUpdated;
      if(categoryLocalIsNewer){
        remoteData.calendarCategories=localCats;
        remoteData.calendarCategoriesUpdatedAt=localCatUpdated;
      }else if(remoteCatUpdated>localCatUpdated && remoteData.calendarCategories){
        try{
          localStorage.setItem(CAT_AUTH_KEY,JSON.stringify(remoteData.calendarCategories));
          localStorage.setItem(CAT_AUTH_UPDATED_KEY,String(remoteCatUpdated));
          localStorage.setItem(CAT_LS_KEY,JSON.stringify(remoteData.calendarCategories));
          localStorage.setItem(CAT_UPDATED_KEY,String(remoteCatUpdated));
        }catch(e){}
      }
      try{if(typeof window.catDiagWrite==='function')window.catDiagWrite('syncNow:remoteData反映直前',{remoteCats:remoteData.calendarCategories,localCats:localCatRaw?JSON.parse(localCatRaw):null,remoteUpdated:remoteData.calendarCategoriesUpdatedAt,localUpdated:localCatUpdated});}catch(_){}
      data=remoteData;
      try{if(typeof window.catDiagWrite==='function')window.catDiagWrite('syncNow:remoteData反映直後',{dataCats:data.calendarCategories,dataUpdated:data.calendarCategoriesUpdatedAt});}catch(_){}
      localStorage.setItem(KEY,JSON.stringify(data));
      localStorage.setItem('monocheck-study-updated',String(remote));
      render();
      if(window.__monoCalendarRefresh)window.__monoCalendarRefresh();
      if(categoryLocalIsNewer){
        status('クラウドデータを反映（カテゴリ設定は端末の新しい値を保持）');msg('カテゴリ設定はこの端末の新しい値を保持しました');
        await push();
      } else {
        status('クラウドから反映しました');msg('クラウドのデータを反映しました');
      }
      localStorage.setItem(KEY,JSON.stringify(data));
      localStorage.setItem('monocheck-study-updated',String(categoryLocalIsNewer?Date.now():remote));
      render();
      if(window.__monoCalendarRefresh)window.__monoCalendarRefresh();
    }
    else{status('同期済み');msg('同期済みです');}
  }catch(e){console.error(e);status('同期エラー');msg(e.message||String(e));}
  finally{busy=false;if(pendingSync){pendingSync=false;clearTimeout(timer);timer=setTimeout(()=>syncNow(),300);}}
};
async function push(){
  try{if(typeof window.catDiagWrite==='function')window.catDiagWrite('push:開始',{before:data.calendarCategories,beforeUpdated:data.calendarCategoriesUpdatedAt});}catch(_){}
  data=mergeLocalCategoriesIntoData(data);
  try{if(typeof window.catDiagWrite==='function')window.catDiagWrite('push:merge後',{dataCats:data.calendarCategories,dataUpdated:data.calendarCategoriesUpdatedAt});}catch(_){}
  let stamp=new Date().toISOString();
  let {error}=await client.from('monocheck_study_data').upsert({user_id:user.id,data:data,updated_at:stamp},{onConflict:'user_id'});
  if(error)throw error;
  try{if(typeof window.catDiagWrite==='function')window.catDiagWrite('push:Supabase upsert後',{dataCats:data.calendarCategories,dataUpdated:data.calendarCategoriesUpdatedAt});}catch(_){}
  localStorage.setItem('monocheck-study-updated',String(Date.parse(stamp)));status('同期済み');msg('クラウドに保存しました');
}
window.queueStudyCloudSync=function(){if(window.__monoViewerMode||!user)return;clearTimeout(timer);timer=setTimeout(()=>syncNow(),700);};
window.addEventListener('online',()=>{if(window.__monoViewerMode)viewerFetch().catch(()=>{});else if(user)syncNow();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(window.__monoViewerMode)viewerFetch().catch(()=>{});else if(user){clearTimeout(timer);timer=setTimeout(()=>syncNow(),300);}}});
window.addEventListener('focus',()=>{if(window.__monoViewerMode)viewerFetch().catch(()=>{});else if(user){clearTimeout(timer);timer=setTimeout(()=>syncNow(),300);}});

(async function boot(){
  try{
    await ensureClient();
    if(viewerToken&&!user){
      const {data:r,error}=await client.rpc('monocheck_viewer_get_data',{p_token:viewerToken});
      if(error)throw error;
      applyViewerData(r,true);setViewerUi(true);
      if(typeof render==='function')render();
    }
  }catch(e){console.warn('sync/viewer boot:',e.message||e);}
})();
})();
