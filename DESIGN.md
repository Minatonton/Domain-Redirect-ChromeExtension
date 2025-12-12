# ドメイン強制リダイレクト拡張 設計書 (簡易版)

## 1. 背景と目的
- 特定の業務外サイトへアクセスした瞬間に、利用者を安全なページ (Google) へ移動させたい。
- ブラウザのブックマークや OS 設定では強制できないため、Chrome 拡張機能として実現する。
- 今回は「対象ドメインの一覧を管理し、その URL を開いたら必ず `https://www.google.com/` に遷移する」という最小要件に絞る。

## 2. スコープ
- Manifest v3 ベースのシンプルな拡張機能。
- Options ページのみ提供し、遮断したいドメイン (例: `example.com`, `*.news.com`) を追加/削除できる。
- 背景 Service Worker が Chrome `declarativeNetRequest` API を使ってリダイレクトルールを生成する。
- ポップアップ UI、履歴、一時停止タイマーなどは実装しない。
- リダイレクト先は固定で `https://www.google.com/`。

## 3. ユースケース
1. 管理者が Options ページで `example.com` を追加して保存。
2. エンドユーザーが `https://example.com/article` を開く。
3. 拡張機能が該当 URL を検知し、直ちに `https://www.google.com/` へ遷移させる。
4. ユーザーは Google トップページへ移動し、元のサイトは閲覧できない。

## 4. 機能要件
- **ドメイン管理**
  - 入力欄にドメイン名もしくは `*.example.com` 形式を登録できる。
  - 登録済みのドメイン一覧を表示し、削除ボタンで即削除できる。
  - 同一ドメインの重複登録は防止する。
- **リダイレクト処理**
  - Chrome `declarativeNetRequest` の動的ルールにて HTTP/HTTPS のメインフレーム通信を捕捉。
  - マッチした場合、例外なく `https://www.google.com/` に 302 リダイレクトさせる。
  - ルール更新はストレージ変更後ただちに反映される。
- **永続化**
  - Chrome `storage.sync` に `redirectDomains` 配列として保存。
  - ブラウザ間で同期されるが、保存できない場合はエラー表示 (Options 側) のみ。

## 5. 非機能要件
- 登録件数が 50 件程度でも操作遅延が体感されないこと。
- Manifest では必要最小限の権限 (`storage`, `declarativeNetRequest`) のみを要求。
- Options ページは CSP `default-src 'self'` を適用し、外部リソースを読み込まない。

## 6. システム構成
- **manifest.json**: 基本情報と権限、Options ページ、Service Worker を定義。
- **background.js**: ストレージのドメイン一覧を読み込み、`chrome.declarativeNetRequest.updateDynamicRules` を用いてルールを生成。ストレージ変更を監視。
- **scripts/storage.js**: `redirectDomains` 配列の読み書きユーティリティ。
- **options.html / options.js / options.css**: ドメイン一覧 UI。入力→追加、削除ボタン、保存結果メッセージを提供。

## 7. データモデル
```json
{
  "redirectDomains": [
    "example.com",
    "*.news.com"
  ]
}
```

## 8. リダイレクトフロー
1. Service Worker 起動時に `redirectDomains` を取得し、各要素を URL フィルター (Adblock 形式) へ変換。
2. 変換結果から DNR ルールを組み立て、既存ルールをすべて削除してから登録。
3. ユーザーが対象サイトを開くと DNR が一致判定を行い、ブラウザが `https://www.google.com/` へ遷移。
4. Options ページでドメインが更新されると storage change イベントが発火し、Service Worker が再度ルールを生成する。

## 9. テスト計画
- 手動テストのみ: Options でドメインを追加 → 新規タブで対象 URL を開き、Google へ即座に遷移することを確認。
- 確認する組み合わせ: `example.com` 単一、`*.example.com` ワイルドカード、HTTP/HTTPS 双方。

## 10. 今後の課題 (任意)
- リダイレクト先 URL を設定可能にする。
- ドメイン数が多い場合の CSV/JSON インポートを検討。
- ブロック理由を示すランディングページを用意し、ユーザー向けメッセージを提供。
