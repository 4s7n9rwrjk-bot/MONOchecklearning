# MONOcheck 学習管理 — スマホPWA同期対策版

今回の主な修正
- PWA起動時にSupabaseライブラリの読み込みを待つ
- Supabase AuthをPKCEフローで初期化
- ログインセッションをlocalStorageへ保持
- Service WorkerはSupabaseなど外部通信を一切キャッシュ/介入しない
- HTML/JS/JSONはネットワーク優先
- Service Workerを自動更新
- 更新後は自動反映

Renderでは、このフォルダの中身を現在のアプリに上書きデプロイしてください。

重要：
スマホのホーム画面に追加済みの古いPWAは、更新版を認識するまで少し時間がかかる場合があります。
デプロイ後、まずスマホのホーム画面アプリを通常どおり起動してください。
