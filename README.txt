MONOcheck 学習管理

■ レポート準備
元のExcelに合わせ、6要素を横並びにし、各列に複数の入力行を追加できます。各行は編集・削除可能です。レポート本文はWordで作成し、専用フォームで提出する前提です。

■ PC・スマホ同期
1. Supabaseでプロジェクトを作成
2. supabase_schema.sql をSQL Editorで実行
3. supabase-config.js に Project URL と Publishable key（Secret/service_roleは不可）を入力
4. Render等でHTTPS公開
5. PCとスマホで同じアカウントにログイン

同期対象：科目、目次、学習予定、実績、レポート準備などアプリ内データ。端末内localStorageにも保存します。
