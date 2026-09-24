# MONOcheck 学習管理・同期完全修正版

PCブラウザとスマホPWAの両方で同じSupabaseアカウントを使って同期する版です。

今回の修正:
- PC側の同期処理を正常な構造で再構築
- スマホPWAのセッション継続
- 保存時の自動同期
- PC/スマホ間で更新日時を比較して新しい方を反映
- 同期中に変更した場合も同期予約を保持
- オンライン復帰時・アプリ復帰時にも同期
- Supabase通信をService Workerから完全分離
- Service Worker自動更新
- ホーム・学習・日別記録にExcel風の「予定残りページ／実績残りページ」折れ線と実績進捗率のドーナツグラフを表示
- 日別記録を保存した後も、保存データを再読込して両グラフを更新
- 青線は予定残りページ、オレンジ線は実績残りページを表示
- ドーナツは教材総ページ数に対する実読ページ数の割合を表示
- JavaScriptとService Workerのキャッシュ識別子を更新し、旧版が残りにくいよう修正

更新時はフォルダ内の index.html、index(4).html、progress-chart.js、service-worker.js をまとめて差し替えてください。progress-chart.js は index.html と同じフォルダに置きます。ブラウザは Ctrl+Shift+R（Macは Cmd+Shift+R）で強制再読み込みしてください。supabase-config.js が既に環境別に設定されている場合は、手元の設定を保持してください。

Renderにはこのフォルダ内のファイルを上書きデプロイしてください。
progress-chart.js はグラフ機能に必要なので、index.html と同じフォルダに置いてください。
