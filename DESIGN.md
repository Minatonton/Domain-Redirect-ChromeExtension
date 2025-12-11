# 強制ドメインリダイレクト Chrome 拡張機能 設計書

## 1. 背景と目的
- ある特定ドメイン (以下「トリガードメイン」) にユーザーがアクセスした瞬間に、意図した別ドメイン/URL (以下「リダイレクト先」) へ強制的に遷移させ、不適切・業務外サイト利用を防ぎたい。
- 手動でのブックマークやホストファイル変更では環境間差分やユーザー操作を強制できないため、ブラウザレベルで制御できる Chrome 拡張機能として実装する。

## 2. 成果物のスコープ
- Manifest v3 ベースの Chrome 拡張機能。
- 単一または複数のトリガードメインとリダイレクト先を設定できる Options UI。
- 背景 Service Worker での URL 監視と強制リダイレクト処理。
- シンプルなポップアップ (任意) に、現在適用されているポリシー概要と一時停止トグルを表示。
- 設計書対象外: 配布方法、管理コンソール配信、他ブラウザ対応。

## 3. 想定利用シナリオ
1. 管理者が Options 画面で `example.com -> https://intranet.example.com/block` のようなペアを登録。
2. ユーザーが任意タブで `https://example.com/news` を開くと、バックグラウンドが直ちにアクセスを検出し `https://intranet.example.com/block?src=example.com` に遷移。
3. ユーザーにはブロック理由と代替リンクがリダイレクト先で案内される。
4. 管理者は必要に応じて一時的にポリシーを停止し、再開時に自動反映される。

## 4. 機能要件
- **リダイレクト定義**
  - トリガードメイン/パスの完全一致またはワイルドカード (`*.example.com`) を定義可能。
  - 各定義ごとに有効/無効フラグ、リダイレクト先 URL、メモ (UI 表示用) を保持。
- **監視・リダイレクト**
  - `chrome.webRequest.onBeforeRequest` (MV3 では `declarativeNetRequest`) で対象 URL を捕捉し、`redirect` アクションを即時適用。
  - 無限リダイレクト防止として、リダイレクト先が再びトリガーマッチした場合は 1 度だけ許容する。
  - HTTP/HTTPS 双方をサポート。
- **設定同期**
  - `chrome.storage.sync` をデフォルト使用し、同期上限を超える場合は `storage.local` に自動フォールバック。
  - JSON エクスポート/インポート機能で複数環境へ同一ポリシーを配布。
- **ポップアップ UI (任意)**
  - 現在の有効ポリシー数、最終更新日時、一時停止トグルを表示。
  - 一時停止中は背景処理を停止し、N 分後に自動復帰する設定も可能。
- **ログと通知**
  - リダイレクト発動時に `chrome.runtime.sendMessage` でポップアップへ通知し、履歴タブに最新 10 件を表示。

## 5. 非機能要件
- パフォーマンス: URL マッチングは軽量な Trie またはプレフィックスツリー風オブジェクトを構築し、100 件程度のポリシーでも遅延を体感させない。
- 安全性: 最小権限原則に従い、必要なホスト権限のみ manifest に列挙。Options ページでは `Content-Security-Policy` を強化。
- 拡張性: リダイレクト条件をドメイン以外 (パス、クエリ、曜日、時間帯) に拡張できるようデータモデルを汎用化。

## 6. システム構成
- **Manifest (manifest.json)**
  - `manifest_version: 3`
  - `permissions`: `declarativeNetRequest`, `storage`, `tabs`
  - `host_permissions`: `*://*/*` (設定 UI で実際に使うドメインだけを推奨)
  - `action`: popup.html
  - `options_page`: options.html
  - `declarative_net_request.rule_resources`: 動的ルールを `dynamicRules` API 経由で投入
- **Background Service Worker (background.js)**
  - 初期化時にストレージのポリシーを読み込み、`chrome.declarativeNetRequest.updateDynamicRules` でルールを構築。
  - ストレージ変更を監視し、ルールを更新。
  - 一時停止トグル状態を保持し、無効化時は全ルール削除。
- **Options UI (options.html + options.js)**
  - CRUD フォームでポリシーを編集。
  - バリデーション (URL 形式、重複ドメイン等) を実装。
  - インポート/エクスポートボタンを提供。
- **Popup UI (popup.html + popup.js)**
  - 現在のステータス表示と一時停止ボタン。
  - 最新リダイレクト履歴 (ストレージに保存) を表示。

## 7. データモデル
```json
{
  "policies": [
    {
      "id": "uuid",
      "pattern": "*.example.com",
      "redirectUrl": "https://intranet.example.com/block",
      "enabled": true,
      "notes": "業務外サイト"
    }
  ],
  "pausedUntil": 0,
  "history": [
    {
      "triggeredAt": 1700000000000,
      "url": "https://example.com/news",
      "redirectUrl": "https://intranet.example.com/block"
    }
  ]
}
```

## 8. リダイレクトフロー
1. Service Worker が `chrome.storage` からポリシーを読み込みルール生成。
2. ユーザーがタブで URL を開く。
3. declarativeNetRequest がルールに一致 ⇒ `redirect` アクションを返却。
4. ブラウザが即座にリダイレクト先へ遷移。
5. Service Worker は履歴を更新し、必要に応じて通知送信。
6. Popup が履歴を取得し UI 表示。

## 9. 設定/ポリシー管理
- CRUD 操作は Options UI からのみ実施。
- Import 時は JSON Schema をチェックし不正値を弾く。
- Export は `Blob` ダウンロードでブラウザ外へ持ち出せる。
- 管理者ロック (任意): パスフレーズ入力で Options UI を read-only にする仕組みを追加予定。

## 10. セキュリティ・プライバシー
- 最低権限での host pattern 指定を推奨し、初期状態では空配列。
- Options/Popup に CSP (`default-src 'self'`) を厳格適用。
- 履歴データはローカル保存のみで、送信は行わない。
- インポート/エクスポートで取り扱うファイルには機微情報が含まれない想定だが、暗号化要件があれば後続で検討。

## 11. テスト戦略
- ユニット: ポリシー CRUD、バリデーション、Trie マッチロジック (Jest など)。
- E2E: Puppeteer で Chrome を起動し、モックサイトへのアクセスが即時リダイレクトされるか確認。
- 手動テスト: 同一ウィンドウ内で複数タブを開き、ルールが競合しないか検証。同期ストレージのロールバック確認。

## 12. リスクと対策
- **MV3 制約**: `webRequestBlocking` が使えないため declarativeNetRequest で表現できない高度な条件は将来的課題。
- **同期上限 (100KB)**: ポリシーが多い場合に `storage.sync` に収まらない ⇒ `storage.local` 自動フォールバックと警告表示。
- **ユーザー抜け道**: 拡張機能停止を防ぐには Chrome 管理ポリシーで無効化を禁止する必要。設計書では手順のみ提示。

## 13. ロードマップ(概略)
1. Week1: プロトタイプ (固定 1 ドメイン) でリダイレクト成立を確認。
2. Week2: Options UI + Storage 連携。
3. Week3: Popup/履歴/一時停止機能。
4. Week4: E2E テスト、自動ビルド、Chrome Web Store 用パッケージング。

## 14. 今後の拡張アイデア
- 時間帯やユーザー属性に応じた条件分岐。
- ブロック表示ページを拡張機能内でホストし、理由/連絡先を表示。
- 管理者がリモート JSON を指定し、定期的にフェッチしてポリシーを更新する仕組み。
