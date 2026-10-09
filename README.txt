MONOcheck 学習管理 v101

このフォルダはアプリのファイル一式です。

主なファイル:
- index.html: 画面・Excel取込・進捗計算
- sync.js: Supabase同期
- progress-chart.js: 進捗グラフ
- service-worker.js: キャッシュ制御
- manifest.json: Webアプリ設定
- supabase-config.js: Supabase接続設定

v101:
- Excel取込時、保存済み数式結果に依存せず最新の値を反映するための修正
- v100までのカテゴリ同期修正を引き継ぎ

注意:
- supabase-config.js は現在利用中の接続設定を保持してください。既存環境にある設定と異なる場合は、既存の設定を優先してください。
- GitHub/Renderに配置する際は、このフォルダ内のファイル一式を使用してください。
