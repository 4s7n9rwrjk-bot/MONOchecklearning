(function(){
let client=null,user=null,busy=false,timer=null,initPromise=null;
const SUPA_URL_KEYS=['MONOCHECK_STUDY_SUPABASE_URL','MONOCHECK_SUPABASE_URL'];
const SUPA_KEY_KEYS=['MONOCHECK_STUDY_SUPABASE_ANON_KEY','MONOCHECK_SUPABASE_ANON_KEY','MONOCHECK_SUPABASE_PUBLISHABLE_KEY'];
function cfg(){
  let url=SUPA_URL_KEYS.map(k=>window[k]).find(Boolean);
  let key=SUPA_KEY_KEYS.map(k=>window[k]).find(Boolean);
  return !!(url && /^https:\/\/[^\s]+\.supabase\.co\/?$/.test(url) && key && window.supabase);
}
function getCfg(){return {url:SUPA_URL_KEYS.map(k=>window[k]).find(Boolean)||'',key:SUPA_KEY_KEYS.map(k=>window[k]).find(Boolean)||''}}
function msg(t){let e=document.getElementById('syncMessage');if(e)e.textContent=t}
function status(t){let e=document.getElementById('syncStatus');if(e)e.textContent=t;let d=document.getElementById('syncDot');if(d)d.textContent=user?'●':'○'}
function localStamp(){return Number(localStorage.getItem('monocheck-study-updated')||0)}
async function ensureClient(){if(client)return client;if(initPromise)return initPromise;initPromise=(async()=>{if(!cfg())throw new Error('Supabase設定が読み込めていません。supabase-config.js のURLとPublishable keyを確認してください。');let c=getCfg();client=window.supabase.createClient(c.url,c.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage,storageKey:'monocheck-study-auth'}});let s=await client.auth.getSession();user=s.data?.session?.user||null;client.auth.onAuthStateChange((_e,session)=>{
  user=session?.user||null;
  if(user){
    status('ログイン継続・同期中…');
    setTimeout(()=>syncNow(false),0);
  }else status('未ログイン');
});if(user)await syncNow(false);else status('未ログイン');return client})().catch(e=>{client=null;status('同期設定エラー');msg(e.message||String(e));throw e}).finally(()=>{initPromise=null});return initPromise}
window.openSyncModal=function(){let m=document.getElementById('syncModal');m.style.display='flex';if(!cfg()){status('Supabase未設定：端末内保存のみ');msg('supabase-config.js のURLとPublishable keyを確認してください。')}else if(user)status('同期アカウントに接続済み');else {status('ログインしてください');if(!client)ensureClient().catch(()=>{})}}
window.closeSyncModal=function(){document.getElementById('syncModal').style.display='none'}
window.syncSignUp=async function(){try{await ensureClient();let email=document.getElementById('syncEmail').value.trim(),password=document.getElementById('syncPassword').value;if(!email||password.length<6)return msg('メールアドレスと6文字以上のパスワードを入力してください');let {error}=await client.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin}});if(error)throw error;msg('登録しました。メール確認が必要な設定なら確認後にログインしてください。')}catch(e){msg(e.message||String(e))}}
window.syncSignIn=async function(){
  try{
    await ensureClient();
    let email=document.getElementById('syncEmail').value.trim();
    let password=document.getElementById('syncPassword').value;
    if(!email||password.length<6)return msg('メールアドレスと6文字以上のパスワードを入力してください');
    msg('Supabaseへ接続しています…');
    let {data,error}=await client.auth.signInWithPassword({email,password});
    if(error)throw error;
    user=data?.user||user;
    msg('ログインしました。同期します…');
    await syncNow(true);
  }catch(e){
    console.error('MONOcheck login error:',e);
    let m=e?.message||String(e);
    if(/failed to fetch/i.test(m)) m='Supabaseへ接続できませんでした。URL・ネットワーク・Supabaseの稼働状態を確認してください。';
    msg(m);
    status('ログイン失敗');
  }
}
window.testSupabaseConnection=async function(){
  try{
    await ensureClient();
    let {error}=await client.auth.getSession();
    if(error)throw error;
    msg('Supabaseへの接続OK');
    status(user?'ログイン継続・同期中…':'未ログイン');
    return true;
  }catch(e){
    console.error('MONOcheck Supabase connection error:',e);
    msg((e?.message||String(e)).replace(/Failed to fetch/i,'Supabaseへ接続できませんでした'));
    status('接続失敗');
    return false;
  }
};

window.syncSignOut=async function(){try{if(client)await client.auth.signOut()}finally{user=null;status('ログアウトしました')}}
window.syncNow=async function(force){if(!client||!user)return msg('Supabaseにログインしてください');if(busy)return;busy=true;status('同期中…');try{let {data:r,error:e}=await client.from('monocheck_study_data').select('data,updated_at').eq('user_id',user.id).maybeSingle();if(e)throw e;let ls=localStamp();let remote=r?.updated_at?Date.parse(r.updated_at):0;if(!r){await push()}else if(force||ls>=remote){await push()}else{data=r.data;localStorage.setItem(KEY,JSON.stringify(data));localStorage.setItem('monocheck-study-updated',String(remote));render();status('クラウドから反映しました')} }catch(e){console.error(e);status('同期エラー');msg(e.message||String(e))}finally{busy=false}}
async function push(){let stamp=new Date().toISOString();let {error}=await client.from('monocheck_study_data').upsert({user_id:user.id,data:data,updated_at:stamp},{onConflict:'user_id'});if(error)throw error;localStorage.setItem('monocheck-study-updated',String(Date.parse(stamp)));status('同期済み');msg('クラウドに保存しました')}
window.queueStudyCloudSync=function(){if(!user||busy)return;clearTimeout(timer);timer=setTimeout(()=>syncNow(true),700)}
ensureClient().catch(()=>{});
})();
