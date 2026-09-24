(function(){
let client=null,user=null,busy=false,timer=null,initPromise=null,pendingSync=false;
const SUPA_URL_KEYS=['MONOCHECK_STUDY_SUPABASE_URL','MONOCHECK_SUPABASE_URL'];
const SUPA_KEY_KEYS=['MONOCHECK_STUDY_SUPABASE_ANON_KEY','MONOCHECK_SUPABASE_ANON_KEY','MONOCHECK_SUPABASE_PUBLISHABLE_KEY'];
function cfg(){let url=SUPA_URL_KEYS.map(k=>window[k]).find(Boolean);let key=SUPA_KEY_KEYS.map(k=>window[k]).find(Boolean);return !!(url&&key&&window.supabase)}
function getCfg(){return {url:SUPA_URL_KEYS.map(k=>window[k]).find(Boolean)||'',key:SUPA_KEY_KEYS.map(k=>window[k]).find(Boolean)||''}}
function msg(t){let e=document.getElementById('syncMessage');if(e)e.textContent=t}
function status(t){let e=document.getElementById('syncStatus');if(e)e.textContent=t;let d=document.getElementById('syncDot');if(d)d.textContent=user?'●':'○'}
function localStamp(){return Number(localStorage.getItem('monocheck-study-updated')||0)}
async function waitForSupabase(){
  if(window.supabase)return true;
  for(let i=0;i<20;i++){
    await new Promise(r=>setTimeout(r,150));
    if(window.supabase)return true;
  }
  return false;
}

async function ensureClient(){if(client)return client;if(initPromise)return initPromise;initPromise=(async()=>{await waitForSupabase();if(!cfg())throw new Error('Supabase設定が読み込めていません。supabase-config.js のURLとPublishable keyを確認してください。');let c=getCfg();client=window.supabase.createClient(c.url,c.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage,storageKey:'monocheck-study-auth',flowType:'pkce'}});let s=await client.auth.getSession();user=s.data?.session?.user||null;client.auth.onAuthStateChange((_e,session)=>{user=session?.user||null;if(user){status('ログイン継続・同期中…');setTimeout(()=>syncNow(false),0)}else status('未ログイン')});if(user)await syncNow(false);else status('未ログイン');return client})().catch(e=>{client=null;status('同期設定エラー');msg(e.message||String(e));throw e}).finally(()=>{initPromise=null});return initPromise}
window.openSyncModal=function(){let m=document.getElementById('syncModal');m.style.display='flex';if(!cfg()){status('Supabase未設定：端末内保存のみ');msg('supabase-config.js のURLとPublishable keyを確認してください。')}else if(user)status('同期アカウントに接続済み');else {status('ログインしてください');if(!client)ensureClient().catch(()=>{})}}
window.closeSyncModal=function(){document.getElementById('syncModal').style.display='none'}
window.syncSignUp=async function(){try{await ensureClient();let email=document.getElementById('syncEmail').value.trim(),password=document.getElementById('syncPassword').value;if(!email||password.length<6)return msg('メールアドレスと6文字以上のパスワードを入力してください');let {error}=await client.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin}});if(error)throw error;msg('登録しました。メール確認が必要な設定なら確認後にログインしてください。')}catch(e){msg(e.message||String(e))}}
window.syncSignIn=async function(){try{await ensureClient();let email=document.getElementById('syncEmail').value.trim(),password=document.getElementById('syncPassword').value;if(!email||password.length<6)return msg('メールアドレスと6文字以上のパスワードを入力してください');let {error}=await client.auth.signInWithPassword({email,password});if(error)throw error;msg('ログインしました。同期します…');await syncNow(false)}catch(e){console.error(e);msg(e.message||String(e))}}
window.syncSignOut=async function(){try{if(client)await client.auth.signOut()}finally{user=null;status('ログアウトしました')}}
window.syncNow=async function(force){if(!client||!user)return msg('Supabaseにログインしてください');if(busy){pendingSync=true;return}busy=true;status('同期中…');try{let {data:r,error:e}=await client.from('monocheck_study_data').select('data,updated_at').eq('user_id',user.id).maybeSingle();if(e)throw e;let ls=localStamp();let remote=r?.updated_at?Date.parse(r.updated_at):0;if(!r){await push()}else if(force||ls>=remote){await push()}else{data=r.data;localStorage.setItem(KEY,JSON.stringify(data));localStorage.setItem('monocheck-study-updated',String(remote));render();status('クラウドから反映しました')} }catch(e){console.error(e);status('同期エラー');msg(e.message||String(e))}finally{busy=false;if(pendingSync){pendingSync=false;clearTimeout(timer);timer=setTimeout(()=>syncNow(false),150)}}
async function push(){let stamp=new Date().toISOString();let {error}=await client.from('monocheck_study_data').upsert({user_id:user.id,data:data,updated_at:stamp},{onConflict:'user_id'});if(error)throw error;localStorage.setItem('monocheck-study-updated',String(Date.parse(stamp)));status('同期済み');msg('クラウドに保存しました')}
window.queueStudyCloudSync=function(){if(!user||busy)return;clearTimeout(timer);timer=setTimeout(()=>syncNow(false),700)}
ensureClient().catch(()=>{});
})();
