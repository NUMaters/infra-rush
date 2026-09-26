# INFRA RUSH 実装計画

唯一のゲーム仕様: `../INFRA_RUSH_SPEC.md` v0.1。開始時点は仕様書のみ。

## 確認済み資料とアセット
Driveの全5分類・下位2フォルダを列挙。12枚を取得・目視確認。ID、原題、URLは references/manifest.json。
既存の利用可能な3Dモデル・音源・実装: なし。
制作するモデル: 作業Bot（青赤マテリアル差替）、三塔の城、油圧ショベル、ブルドーザー、6輪グレーダー、トラス式架橋機、ドリル機、石橋、鉄橋、木、岩、柵、資材、コーン、盛土。橋のひび割れ・欠損・崩落を別表示。
Blenderの再生成可能なPythonスクリプトと.blendを保存しGLBを出力。名前付き部品をThree.jsでアニメーション。

## スケール
Bot高さ1.0。城6×6、高さ4.0（旗除く）。橋長6・幅3、柱高2。小型重機高2.2前後、架橋機長6.5。河川幅6。アート資料に合わせ、青城は奥左・青採石場は奥右、赤城は手前右・赤採石場は手前左。プレイヤーは青。固定斜俯瞰で全体表示、拡大操作を補助。

## 構造
- master/: game, resources, tasks, bridges, vehicles, earthquake, bots, castle, cpu のJSON
- src/game/: 型、マスター、決定的シミュレーション、CPU。DOM/Three.js非依存
- src/render/: Three.jsワールド、GLBキャッシュ、動作・パーティクル
- src/ui/: モバイル優先HUD、文言・効果音
- assets/blender/: 制作スクリプト・編集可能.blend
- public/models/: 本番でロードするGLB
- tests/: Vitestによるルール検証、Playwrightによる実ブラウザE2E
- docs/qa/: 比較画面・計測結果と未確認項目

## Phase 1 タスクリスト
- [x] 全仕様・全デザイン画像確認
- [x] アセット棚卸し・スケール・設計・判断記録
- [ ] Blenderアセット制作、ゲーム画面との比較
- [x] 採掘→橋建設→進軍→1ダメージ→帰還（PC/モバイル幅E2E）
- [x] 盛土→阻止→整地（追加E2EでCPU整地まで確認）
- [x] 補強→ドリル→修繕、中央橋所有権（ロジックテスト、施工E2E）
- [x] 地震、CPU戦略と難易度（実装・ロジック検証。面白さの評価は継続）
- [x] タイトル・Bot直接選択・条件別ボタン・SE・勝敗・リザルト・再戦
- [x] strict/lint/format/unit/game/Bot/resource/CPU/E2E（検証詳細はqa/VALIDATION.md）
- [ ] 実ブラウザとモバイル表示、FPS/メモリ/GLB/ロード計測
- [ ] Android/iOS実機、プレイテスト、全完了条件の証拠

Phase 1の全条件を検証するまでPhase 2へ着手しない。Phase 2はGo authoritative / WebSocket / rooms / sequence / reconnect / heartbeat / snapshotsとプロトコル・2ブラウザ試験。
