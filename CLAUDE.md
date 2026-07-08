# Number Sync Friends (ito風協力ゲーム)

## 注意点
- ここにあるコードについては、すべてバイブコーディングであるため、コードの詳しい実装方法(変数の使い方など)は把握していません。修正内容の説明の際は、それを考慮した詳しい説明にしてください。
- コードの修正、新しい実装をするときは、すべて実際に編集する前に plan mode で事前に計画を立てて承認を得るようにしてください。
- index.html, style.css, script-2.jsがメインファイルになります。それらを参照してください。

## プロジェクト概要
- 「1〜100の数字をお題に沿った言葉で表現し、全員のカードを小さい順に並べる」協力ゲーム。ビルドなし・ブラウザのみで動作（GitHub Pages 想定）
- 構成: `index.html`（全画面・全モーダル） / `style.css` / `script-2.js`（単一クラス `GameManager`） / `csv/`（お題デッキ）
- バックエンド: Firebase Realtime Database（**全開放ルール・認証なし**）。カード並べ替えは SortableJS（CDN）
- 仕様の詳細と既知の制約は `docs/SPEC.md` を参照

## データモデル (rooms/{3桁roomId}/)
- `host`: ホストの名前（文字列）
- `theme`: `{title, min, max}` / `themeType`: `normal|rainbow|classic|all`
- `status`: `'playing' | 'revealed'`
- `lastActivity`: タイムスタンプ。**1時間更新がないと部屋がクライアントから自動削除される**
- `members/{pushKey}`: `{name, joinedAt, isOnline}`
- `cards/{card_<ts>_<rand>}`: `{name, value(1-100), memo?(30文字以内・任意)}`
- `order`: 提出済みカードキーの配列＝場の並び順。**order に含まれるカードだけが「提出済み」**
- `history/{pushKey}`: `{theme, isSuccess, resultDetails, cards?: [{name, value, memo?}], timestamp}`
- 不変条件: **本人判定はすべて name 文字列の一致**（uid は存在しない）。同名入室は「オフラインなら乗っ取り（再入室扱い）」

## 開発ルール（必ず守る）
- ユーザー入力（名前・メモ・お題・履歴文字列）を `innerHTML` に埋め込まない。`el()` ヘルパー＋ `textContent` でDOMを組み立てる
- `order` / `cards` など複数人が同時に書き込む場所は「get→加工→set」禁止。`runTransaction` を使う（例外: Sortable onEnd の並べ替えのみ last-write-wins 許容）
- DBセキュリティルールは**全開放のまま維持する**（ユーザーの明示的な判断。変更を再提案しない）
- ゲーム状態を書き込む操作を追加・変更したら `lastActivity` の更新要否を確認する（更新漏れ＝プレイ中に部屋が消えるバグ）
- `renderField` は `_lastFieldState`（stateKey）で再描画をスキップする。**表示に影響する状態を追加したら stateKey にも含める**
- 仕様を変更したら `docs/SPEC.md` を更新する
- 修正完了後は `.claude/skills/regression-check/SKILL.md` の回帰チェックを必ず実施し、動作確認は `.claude/skills/verify/SKILL.md` に従う

## 既知のバグクラス（変更時に必ず確認）
1. 同時操作の競合: 2人同時の提出・ドロー・キックで `order`/`cards` が壊れないか
2. 再入室・途中退席・オフライン復帰: sessionStorage 復元、`isOnline`、`onDisconnect` の整合
3. ホスト移譲: ホスト退出時の自動継承（joinedAt順）、ホストUIの表示切替
4. `lastActivity` と自動削除: 長時間プレイ中に部屋が消えないか
5. OPEN後の挙動: OPEN後入室は観戦扱い、OPEN後は並べ替え・メモ編集不可
6. 複数タブ・同名入室: name基準の本人判定に起因する取り違え

## 動作確認
1. `node --check` で構文チェック（ESModuleのため `.mjs` にコピーしてチェック）
2. `python3 -m http.server 8080` でローカル起動（許可済みコマンド）
3. ブラウザ2タブ・別名で入室してスモークテスト（手順の詳細: `.claude/skills/verify/SKILL.md`）
