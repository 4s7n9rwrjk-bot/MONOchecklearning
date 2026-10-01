(function () {
    let supabaseClient = null;
    let currentUser = null;
    let saveTimer = null;
    let suppressCloudSync = false;

    const META_KEY = 'monocheck_local_updated_at';

    function configured() {
        return !!(window.MONOCHECK_SUPABASE_URL && window.MONOCHECK_SUPABASE_ANON_KEY && window.supabase);
    }

    function setStatus(text, state = 'idle') {
        const textEl = document.getElementById('sync-status-text');
        const dot = document.getElementById('sync-status-dot');
        if (textEl) textEl.textContent = text;
        if (dot) {
            dot.className = 'w-2 h-2 rounded-full ' + (state === 'online' ? 'bg-emerald-500' : state === 'syncing' ? 'bg-amber-400' : state === 'error' ? 'bg-rose-500' : 'bg-slate-300');
        }
    }

    function showMessage(text, type = 'info') {
        const el = document.getElementById('sync-message');
        if (!el) return;
        el.textContent = text;
        el.className = 'text-xs rounded-2xl px-4 py-3 ' + (type === 'error' ? 'bg-rose-50 text-rose-700' : type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600');
    }

    function updateAccountUI() {
        const login = document.getElementById('sync-login-area');
        const account = document.getElementById('sync-account-area');
        const email = document.getElementById('sync-user-email');
        if (currentUser) {
            login?.classList.add('hidden');
            account?.classList.remove('hidden');
            if (email) email.textContent = currentUser.email || 'ログイン中';
        } else {
            login?.classList.remove('hidden');
            account?.classList.add('hidden');
        }
    }

    window.openSyncModal = function () {
        const modal = document.getElementById('sync-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        updateAccountUI();
        if (!configured()) {
            setStatus('クラウド同期の設定がまだありません');
            showMessage('Supabaseの設定を入れると、PCとスマホの同期が使えます。', 'info');
        } else if (currentUser) {
            setStatus('同期アカウントに接続済み', 'online');
        } else {
            setStatus('ログインしてください');
        }
    };

    window.closeSyncModal = function () {
        const modal = document.getElementById('sync-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };

    window.initCloudSync = async function () {
        if (!configured()) {
            setStatus('端末内保存モード');
            return;
        }

        try {
            supabaseClient = window.supabase.createClient(window.MONOCHECK_SUPABASE_URL, window.MONOCHECK_SUPABASE_ANON_KEY);
            const { data } = await supabaseClient.auth.getSession();
            currentUser = data?.session?.user || null;
            updateAccountUI();
            if (currentUser) {
                setStatus('同期中…', 'syncing');
                await syncNow();
            } else {
                setStatus('未ログイン');
            }

            supabaseClient.auth.onAuthStateChange(async (_event, session) => {
                currentUser = session?.user || null;
                updateAccountUI();
                if (currentUser) {
                    setStatus('同期中…', 'syncing');
                    await syncNow();
                } else {
                    setStatus('未ログイン');
                }
            });
        } catch (e) {
            console.error(e);
            setStatus('同期設定エラー', 'error');
        }
    };

    window.syncSignUp = async function () {
        if (!configured()) return showMessage('先にsupabase-config.jsを設定してください。', 'error');
        const email = document.getElementById('sync-email')?.value.trim();
        const password = document.getElementById('sync-password')?.value;
        if (!email || !password) return showMessage('メールアドレスとパスワードを入力してください。', 'error');
        if (password.length < 6) return showMessage('パスワードは6文字以上にしてください。', 'error');
        const { error } = await supabaseClient.auth.signUp({ email, password });
        if (error) return showMessage(error.message, 'error');
        showMessage('登録しました。確認メールが届く設定の場合は、メール確認後にログインしてください。', 'success');
    };

    window.syncSignIn = async function () {
        if (!configured()) return showMessage('先にsupabase-config.jsを設定してください。', 'error');
        const email = document.getElementById('sync-email')?.value.trim();
        const password = document.getElementById('sync-password')?.value;
        if (!email || !password) return showMessage('メールアドレスとパスワードを入力してください。', 'error');
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) return showMessage(error.message, 'error');
        showMessage('ログインしました。データを同期しています。', 'success');
    };

    window.syncSignOut = async function () {
        if (!supabaseClient) return;
        await supabaseClient.auth.signOut();
        currentUser = null;
        updateAccountUI();
        setStatus('未ログイン');
        showMessage('ログアウトしました。端末内のデータは残ります。', 'info');
    };

    window.queueCloudSync = function () {
        if (suppressCloudSync || !currentUser || !supabaseClient) return;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => syncNow(), 900);
    };

    window.syncNow = async function () {
        if (!currentUser || !supabaseClient) {
            if (!currentUser) showMessage('同期するには同じアカウントでログインしてください。', 'error');
            return;
        }

        setStatus('同期中…', 'syncing');
        try {
            const { data: remote, error } = await supabaseClient
                .from('monocheck_data')
                .select('data, updated_at')
                .eq('user_id', currentUser.id)
                .maybeSingle();
            if (error) throw error;

            const localUpdated = Number(localStorage.getItem(META_KEY) || 0);

            if (!remote) {
                const { error: upsertError } = await supabaseClient.from('monocheck_data').upsert({
                    user_id: currentUser.id,
                    data: appData,
                    updated_at: new Date(localUpdated || Date.now()).toISOString()
                });
                if (upsertError) throw upsertError;
                localStorage.setItem(META_KEY, String(localUpdated || Date.now()));
                setStatus('同期済み', 'online');
                return;
            }

            const remoteUpdated = new Date(remote.updated_at).getTime();
            if (localUpdated > remoteUpdated + 1000) {
                const { error: upsertError } = await supabaseClient.from('monocheck_data').upsert({
                    user_id: currentUser.id,
                    data: appData,
                    updated_at: new Date(localUpdated).toISOString()
                });
                if (upsertError) throw upsertError;
            } else if (remoteUpdated > localUpdated + 1000) {
                suppressCloudSync = true;
                appData.items = remote.data?.items || [];
                appData.tasks = remote.data?.tasks || [];
                appData.relations = remote.data?.relations || {};
                appData.checkedItems = remote.data?.checkedItems || {};
                localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
                localStorage.setItem(META_KEY, String(remoteUpdated));
                renderHomeTasks();
                if (typeof renderMasterItems === 'function') renderMasterItems();
                if (typeof renderMasterTasks === 'function') renderMasterTasks();
                if (typeof renderRelationsMatrix === 'function') renderRelationsMatrix();
                suppressCloudSync = false;
            }
            setStatus('同期済み', 'online');
        } catch (e) {
            console.error('Cloud sync error:', e);
            setStatus('同期エラー', 'error');
            showMessage('同期に失敗しました。supabase-config.js、Supabaseのテーブル/RLS、ログイン状態を確認してください。', 'error');
        }
    };
})();
