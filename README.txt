# MONOcheck 学習管理 - 同期トラブル対策版

今回の版では、現在の Supabase 設定を保持したまま、同期まわりを強化しています。

変更点:
- Supabase URL の形式チェック
- ログイン時の通信エラー表示を改善
- Supabase 接続確認ボタンを追加
- ログイン後のセッション継続処理を維持
- 現在の supabase-config.js の値をそのまま収録
- 既存の学習データ・進捗・レポート準備・科目管理機能は維持

使い方:
1. このフォルダ一式を GitHub/Render にアップロード
2. Render を再デプロイ
3. 同期画面で「接続確認」
4. 「Supabaseへの接続OK」と出れば通信は成功
5. その後「ログイン」

注意:
- supabase-config.js の Publishable key はブラウザ用公開キーを使用。
- service_role / Secret key は入れない。
- Service Worker が古い index.html を保持する場合は、再読み込みまたはサイトデータ/キャッシュ更新を行う。
