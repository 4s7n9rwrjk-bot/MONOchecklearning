(function(){
let client=null,user=null,busy=false,timer=null;
function cfg(){return !!(window.MONOCHECK_STUDY_SUPABASE_URL&&window.MONOCHECK_STUDY_SUPABASE_ANON_KEY)}
function msg(t){let e=document.getElementById('syncMessage');if(e)e.textContent=t}
function status(t){let e=document.getElementById('syncStatus');if(e)e.textContent=t;let d=document.getElementById('syncDot');if(d)d.textContent=user?'●':'○';}
function localStamp(){return Number(localStorage.getItem('monocheck-study-updated')||0)}
function markLocal(){localStorage.setItem('monocheck-study-updated',String(Date.now()))}
window.openSyncModal=function(){let m=document.getElementById('syncModal');m.style.display='flex';if(!cfg()){status('Supabase未設定：端末内保存のみ');msg('supabase-config.js にProject URLとPublishable keyを設定してください。')}else if(user)status('同期アカウントに接続済み');else status('ログインしてください')}
window.closeSyncModal=function(){document.getElementById('syncModal').style.display='none'}
window.syncSignUp=async function(){if(!client)return msg('Supabase設定が必要です');let email=document.getElementById('syncEmail').value.trim(),password=document.getElementById('syncPassword').value;if(!email||password.length<6)return msg('メールアドレスと6文字以上のパスワードを入力してください');let {error}=await client.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin}});if(error)msg(error.message);else msg('登録しました。メール確認が必要な設定なら確認後にログインしてください。')}
window.syncSignIn=async function(){if(!client)return msg('Supabase設定が必要です');let email=document.getElementById('syncEmail').value.trim(),password=document.getElementById('syncPassword').value;let {error}=await client.auth.signInWithPassword({email,password});if(error)msg(error.message);else{msg('ログインしました。同期します…');await syncNow(true)}}
window.syncSignOut=async function(){if(client)await client.auth.signOut();user=null;status('ログアウトしました')}
window.syncNow=async function(force){if(!client||!user)return msg('Supabaseにログインしてください');if(busy)return;busy=true;status('同期中…');try{let {data:r,error:e}=await client.from('monocheck_study_data').select('data,updated_at').eq('user_id',user.id).maybeSingle();if(e)throw e;let ls=localStamp();let remote= r?.updated_at?Date.parse(r.updated_at):0;if(!r){await push();}else if(force||ls>=remote){await push();}else{data=r.data;localStorage.setItem(KEY,JSON.stringify(data));localStorage.setItem('monocheck-study-updated',String(remote));render();status('クラウドから反映しました');} }catch(e){console.error(e);status('同期エラー');msg(e.message||String(e))}finally{busy=false}}
async function push(){let stamp=new Date().toISOString();let {error}=await client.from('monocheck_study_data').upsert({user_id:user.id,data:data,updated_at:stamp},{onConflict:'user_id'});if(error)throw error;localStorage.setItem('monocheck-study-updated',String(Date.parse(stamp)));status('同期済み');msg('クラウドに保存しました')}
window.queueStudyCloudSync=function(){if(!user||busy)return;clearTimeout(timer);timer=setTimeout(()=>syncNow(true),700)}
async function init(){if(!cfg()){status('端末内保存モード');return}try{client=supabase.createClient(window.MONOCHECK_STUDY_SUPABASE_URL,window.MONOCHECK_STUDY_SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage,storageKey:'monocheck-study-auth'}});let s=await client.auth.getSession();user=s.data?.session?.user||null;if(user)await syncNow(false);else status('未ログイン');client.auth.onAuthStateChange((_e,session)=>{user=session?.user||null;if(user){status('ログイン継続・同期中…');setTimeout(()=>syncNow(false),0)}else status('未ログイン')})}catch(e){status('同期設定エラー');msg(e.message||String(e))}}
init();
})();
