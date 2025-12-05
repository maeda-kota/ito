const fieldArea = document.getElementById('field-area');
const playBtn = document.getElementById('play-btn');
const myCard = document.getElementById('my-card');

// UI要素
const themeText = document.getElementById('theme-text');
const rangeMin = document.getElementById('range-min');
const rangeMax = document.getElementById('range-max');

// SortableJS初期化（前回と同じ）
new Sortable(fieldArea, {
    animation: 150,
    ghostClass: 'sortable-ghost'
});

// --- 1. CSV読み込み機能 ---
// 大学の研究でも実験データの読み込みでよく使うパターンです
async function loadThemeData() {
    try {
        const response = await fetch('themes.csv');
        const text = await response.text();
        
        // 改行で分割して行ごとの配列にする
        const lines = text.trim().split('\n');
        
        // 1行目はヘッダーなので削除し、データ部分のみ抽出
        const dataLines = lines.slice(1);
        
        // ランダムに1行選ぶ
        const randomLine = dataLines[Math.floor(Math.random() * dataLines.length)];
        
        // カンマで分割して各要素を取得 [お題, 最小説明, 最大説明]
        const [theme, minDesc, maxDesc] = randomLine.split(',');

        // 画面に反映
        themeText.textContent = theme;
        rangeMin.textContent = `← 小：${minDesc}`;
        rangeMax.textContent = `大：${maxDesc} →`;

    } catch (error) {
        console.error("CSV読み込みエラー:", error);
        themeText.textContent = "お題の読み込みに失敗しました";
    }
}

// ページ読み込み時に実行
loadThemeData();


// --- 2. カード提出ロジック（修正版：ピーキング機能付き） ---
playBtn.addEventListener('click', () => {
    // 既に提出済みなら何もしない
    if (myCard.classList.contains('submitted')) return;

    // 1. 現在の自分の数字を保存しておく（物理メモリへの退避）
    const myValue = myCard.textContent;

    // 2. 場にカードを出す処理（他人の画面用データ作成）
    const newCard = document.createElement('div');
    newCard.classList.add('card', 'field-card');
    newCard.textContent = "自分"; 
    newCard.dataset.value = myValue; 
    fieldArea.appendChild(newCard);

    // 3. 手元のカードの状態変更
    myCard.classList.add('submitted'); // グレーアウト
    myCard.textContent = "済"; // 一旦隠す
    
    // ボタンを無効化
    playBtn.textContent = "提出済み";
    playBtn.disabled = true;
    playBtn.style.backgroundColor = "#95a5a6";

    // 4. 【新機能】クリックで数字を確認できるイベントを追加
    // 「伏せたカードをチラッと見る」動作の再現です
    myCard.addEventListener('click', () => {
        if (myCard.textContent === "済") {
            myCard.textContent = myValue; // 数字に戻す
        } else {
            myCard.textContent = "済";    // また隠す
        }
    });
});

// --- 3. OPENボタン（前回と同じ） ---
document.getElementById('reveal-btn').addEventListener('click', () => {
    const cards = document.querySelectorAll('.field-card');
    cards.forEach(card => {
        const val = card.dataset.value;
        card.textContent = val;
        card.style.backgroundColor = "#fff";
        card.style.color = "#e74c3c";
    });
});