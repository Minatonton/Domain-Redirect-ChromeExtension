# Domain Redirect Chrome Extension

特定ドメインへのアクセスを検知すると、即座に `https://www.google.com/` へリダイレクトさせるシンプルな Chrome 拡張です。登録したドメインはすべて main frame の HTTP/HTTPS 通信で強制的に Google へ誘導されます。

## 動作仕様
- Manifest v3 + Service Worker (background.js)
- Chrome `declarativeNetRequest` の動的ルールを利用
- Options ページでドメインを追加/削除
- トリガーに一致したら無条件に `https://www.google.com/` へリダイレクト

## 使い方
1. Chrome で `chrome://extensions` を開き、「デベロッパーモード」を ON。
2. 「パッケージ化されていない拡張機能を読み込む」でこのディレクトリを選択。
3. ツールバーに表示された拡張アイコンをクリックするとオプションページが自動で開くので、`example.com` などのドメインを追加。
4. 追加したドメインへアクセスすると即座に Google へ遷移します。

ヒント: `*.example.com` のように先頭に `*.` を付けた場合も、`example.com` として保存されサブドメインを含めてブロックします。

## ファイル構成
- `manifest.json` — 権限と Service Worker/Options ページの定義
- `background.js` — ストレージからドメイン一覧を読み込み、DNR ルールを更新
- `scripts/storage.js` — `redirectDomains` 配列の読み書きユーティリティ
- `options.*` — ドメイン追加/削除 UI
- `DESIGN.md` — 要件と設計方針

## 動作確認
- Options で `example.com` を登録し、`https://example.com/` または `http://example.com/` を開いて Google へ転送されることを確認
- `*.example.com` を登録し、`https://news.example.com/` など任意のサブドメインで同じ動作になることを確認

不具合や追加要望があれば DESIGN.md を更新のうえで機能拡張してください。
