import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, set, get, remove, onDisconnect, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ★★★ ここに自分のAPIキーを入れてください ★★★
const firebaseConfig = {
  apiKey: "AIzaSyCmjB1_CBCYXzNj_GhPUEIiGXwunqo1pbA",
  authDomain: "ito-friends-game.firebaseapp.com",
  databaseURL: "https://ito-friends-game-default-rtdb.firebaseio.com",
  projectId: "ito-friends-game",
  storageBucket: "ito-friends-game.firebasestorage.app",
  messagingSenderId: "161523652496",
  appId: "1:161523652496:web:8f7c4763a6a0f4d2208515"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- 変数 ---
let currentRoomId = null;
let myName = null;
let myNumber = null;
let myCardRef = null;
let myMemberRef = null;
let isHost = false;
let allThemes = [];
let currentThemeTitle = "";

// --- DOM要素 ---
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const usernameInput = document.getElementById('username-input');
const roomInput = document.getElementById('room-input');
const joinBtn = document.getElementById('join-btn');

const fieldArea = document.getElementById('field-area');
const playBtn = document.getElementById('play-btn');
const myCardElement = document.getElementById('my-card');
const themeText = document.getElementById('theme-text');
const rangeMin = document.getElementById('range-min');
const rangeMax = document.getElementById('range-max');

// ホスト制御・履歴
const hostControls = document.getElementById('host-controls');
const nextGameBtn = document.getElementById('next-game-btn');
const resetBtn = document.getElementById('reset-btn');
const revealBtn = document.getElementById('reveal-btn');
const historyBtn = document.getElementById('history-btn');
const historyModal = document.getElementById('history-modal');
const closeHistoryBtn = document.getElementById('close-history');
const historyList = document.getElementById('history-list');

// メンバー・結果
const memberCount = document.getElementById('member-count');
const memberList = document.getElementById('member-list');
const toggleMembersBtn = document.getElementById('toggle-members');
const resultOverlay = document.getElementById('result-overlay');
const resultBox = document.querySelector('.result-box');
const resultTitle = document.getElementById('result-title');
const resultDesc = document.getElementById('result-desc');
const closeResultBtn = document.getElementById('close-result');

// SortableJS
new Sortable(fieldArea, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: function () {
        if (!currentRoomId) return;
        const newOrder = Array.from(fieldArea.children).map(card => card.dataset.id);
        set(ref(db, `rooms/${currentRoomId}/order`), newOrder);
    }
});

// CSV読み込み
async function fetchThemeData() {
    try {
        const response = await fetch('themes.csv');
        const text = await response.text();
        allThemes = text.trim().split('\n').slice(1);
    } catch (e) { console.error("CSV読込エラー", e); }
}
fetchThemeData();

function getRandomTheme() {
    if (allThemes.length === 0) return { title: "お題読込中", min: "小", max: "大" };
    const randomLine = allThemes[Math.floor(Math.random() * allThemes.length)];
    const [title, min, max] = randomLine.split(',');
    return { title, min, max };
}

// ==========================================
// 入室処理 (修正箇所)
// ==========================================
joinBtn.addEventListener('click', async () => {
    const name = usernameInput.value.trim();
    const room = roomInput.value.trim();
    if (!name || !room) { alert("入力してください"); return; }

    const roomRef = ref(db, `rooms/${room}`);
    const snapshot = await get(roomRef);
    const roomData = snapshot.val();

    // 1. 名前重複チェック
    if (roomData && roomData.members) {
        const isNameTaken = Object.values(roomData.members).some(m => m.name === name);
        // ※自分自身が再入室する場合（リロード時）は許可したいので、
        // 厳密にはここも調整が必要ですが、一旦「名前を変える」か「リセット」で対処可能です。
        // 今回はホスト判定の修正を優先します。
    }

    // 2. ★ホスト判定（ここを修正しました）
    if (!roomData || !roomData.host) {
        // 部屋がない、またはホスト不在なら自分がホスト
        isHost = true;
        const initialTheme = getRandomTheme();
        await set(roomRef, {
            host: name,
            theme: initialTheme,
            status: 'playing'
        });
    } else if (roomData.host === name) {
        // ★修正: 既にホストがいて、それが自分なら権限復活
        isHost = true;
    } else {
        // 別の人がホスト
        isHost = false;
    }

    myName = name;
    currentRoomId = room;

    // 3. メンバー登録
    const membersRef = ref(db, `rooms/${currentRoomId}/members`);
    myMemberRef = push(membersRef, {
        name: myName,
        joinedAt: Date.now()
    });
    onDisconnect(myMemberRef).remove();
    
    // UI初期化：ホストならボタンを表示
    if (isHost) {
        hostControls.classList.remove('hidden');
    } else {
        hostControls.classList.add('hidden');
    }

    drawNewCard();
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');

    startListeningToRoom();
    startListeningToHistory();
});

function drawNewCard() {
    myNumber = Math.floor(Math.random() * 100) + 1;
    myCardElement.textContent = myNumber;
    
    myCardElement.classList.remove('submitted');
    playBtn.textContent = "カードを出す";
    playBtn.disabled = false;
    playBtn.style.backgroundColor = ""; 
    myCardRef = null;
    
    resultOverlay.classList.add('hidden');
}

// ==========================================
// ゲームアクション
// ==========================================
playBtn.addEventListener('click', () => {
    if (playBtn.disabled) return;
    myCardRef = push(ref(db, `rooms/${currentRoomId}/cards`), {
        name: myName, value: myNumber
    });
    onDisconnect(myCardRef).remove();

    myCardElement.classList.add('submitted');
    myCardElement.textContent = "済";
    playBtn.textContent = "提出済み";
    playBtn.disabled = true;
    playBtn.style.backgroundColor = "#95a5a6";

    myCardElement.onclick = () => {
        myCardElement.textContent = (myCardElement.textContent === "済") ? myNumber : "済";
    };
});

// OPENボタン
revealBtn.addEventListener('click', async () => {
    const snapshot = await get(ref(db, `rooms/${currentRoomId}`));
    const roomData = snapshot.val();
    if (roomData.status === 'revealed') return;

    const { isSuccess, resultText } = calculateResult(roomData);

    const historyEntry = {
        theme: currentThemeTitle,
        isSuccess: isSuccess,
        resultDetails: resultText,
        timestamp: Date.now()
    };

    const updates = {};
    updates[`rooms/${currentRoomId}/status`] = 'revealed';
    const newHistoryKey = push(ref(db, `rooms/${currentRoomId}/history`)).key;
    updates[`rooms/${currentRoomId}/history/${newHistoryKey}`] = historyEntry;

    await update(ref(db), updates);
});

// 次のゲームへ
nextGameBtn.addEventListener('click', () => {
    if (!confirm("次のゲームに進みますか？")) return;
    const newTheme = getRandomTheme();
    
    update(ref(db, `rooms/${currentRoomId}`), {
        theme: newTheme,
        status: 'playing',
        cards: null,
        order: null
    });
});

// リセット
resetBtn.addEventListener('click', () => {
    if (!confirm("全データを削除しますか？")) return;
    remove(ref(db, `rooms/${currentRoomId}`));
});

// UI操作系
toggleMembersBtn.addEventListener('click', () => {
    memberList.classList.toggle('hidden');
});
closeResultBtn.addEventListener('click', () => {
    resultOverlay.classList.add('hidden');
});
historyBtn.addEventListener('click', () => historyModal.classList.remove('hidden'));
closeHistoryBtn.addEventListener('click', () => historyModal.classList.add('hidden'));
window.addEventListener('click', (e) => {
    if (e.target == historyModal) historyModal.classList.add('hidden');
});


// ==========================================
// 判定ロジック
// ==========================================
function calculateResult(roomData) {
    if (!roomData || !roomData.cards) return { isSuccess: true, resultText: "カードなし" };

    const cardsObj = roomData.cards;
    const orderList = roomData.order || [];

    let cardsArray = Object.keys(cardsObj).map(key => ({ id: key, ...cardsObj[key] }));
    cardsArray.sort((a, b) => {
        const indexA = orderList.indexOf(a.id);
        const indexB = orderList.indexOf(b.id);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    let isSuccess = true;
    let resultTextArray = [];
    
    for (let i = 0; i < cardsArray.length; i++) {
        const current = cardsArray[i];
        const val = parseInt(current.value);
        if (i > 0) {
            const prev = cardsArray[i-1];
            if (val < parseInt(prev.value)) {
                isSuccess = false;
            }
        }
        resultTextArray.push(`${current.name}(${val})`);
    }

    return { isSuccess, resultText: resultTextArray.join(" → ") };
}


// ==========================================
// 同期・監視ロジック
// ==========================================
function startListeningToRoom() {
    const roomRef = ref(db, `rooms/${currentRoomId}`);
    onValue(roomRef, (snapshot) => {
        const roomData = snapshot.val();
        if (!roomData) {
            alert("リセットされました");
            location.reload();
            return;
        }

        if (roomData.theme) {
            themeText.textContent = roomData.theme.title;
            currentThemeTitle = roomData.theme.title;
            rangeMin.textContent = `← 小：${roomData.theme.min}`;
            rangeMax.textContent = `大：${roomData.theme.max}`;
        }

        if (!roomData.cards && roomData.status === 'playing') {
            fieldArea.innerHTML = "";
            if (playBtn.disabled) drawNewCard();
        }

        if (roomData.cards) {
            renderField(roomData);
        } else {
            fieldArea.innerHTML = "";
        }

        if (roomData.members) {
            renderMemberList(roomData.members, roomData.cards);
        } else {
            memberCount.textContent = "参加者: 0人";
            memberList.innerHTML = "";
        }

        if (roomData.status === 'revealed') {
            const result = calculateResult(roomData);
            showGameResult(result);
        } else {
            if (!resultOverlay.classList.contains('hidden') && !roomData.cards) {
                resultOverlay.classList.add('hidden');
            }
        }
    });
}

function renderField(roomData) {
    const cardsObj = roomData.cards;
    const orderList = roomData.order || [];
    const isRevealed = (roomData.status === 'revealed');

    let cardsArray = Object.keys(cardsObj).map(key => ({ id: key, ...cardsObj[key] }));
    cardsArray.sort((a, b) => {
        const indexA = orderList.indexOf(a.id);
        const indexB = orderList.indexOf(b.id);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    fieldArea.innerHTML = "";
    cardsArray.forEach(cardData => {
        const newCard = document.createElement('div');
        newCard.classList.add('card', 'field-card');
        
        if (isRevealed) {
            newCard.textContent = cardData.value;
            newCard.classList.add('revealed');
        } else {
            newCard.textContent = cardData.name;
        }
        newCard.dataset.value = cardData.value;
        newCard.dataset.id = cardData.id;
        fieldArea.appendChild(newCard);
    });
}

function renderMemberList(membersObj, cardsObj) {
    const members = Object.values(membersObj);
    const total = members.length;
    const submittedNames = cardsObj ? Object.values(cardsObj).map(c => c.name) : [];
    let submittedCount = 0;
    
    memberList.innerHTML = "";
    members.forEach(member => {
        const isSubmitted = submittedNames.includes(member.name);
        if (isSubmitted) submittedCount++;
        
        const item = document.createElement('div');
        item.classList.add('member-item');
        const icon = isSubmitted ? '<span class="status-icon done">✔</span>' : '<span class="status-icon thinking">🤔</span>';
        
        item.innerHTML = `${icon} ${member.name}`;
        memberList.appendChild(item);
    });
    memberCount.textContent = `提出: ${submittedCount}/${total}人 (参加: ${total}人)`;
}

function showGameResult(result) {
    if (!resultOverlay.classList.contains('hidden')) return;
    resultOverlay.classList.remove('hidden');
    resultBox.className = "result-box"; 
    if (result.isSuccess) {
        resultBox.classList.add('success');
        resultTitle.textContent = "🎉 MISSION COMPLETE! 🎉";
        resultDesc.textContent = "素晴らしい！全員の心が一つになりました！";
    } else {
        resultBox.classList.add('fail');
        resultTitle.textContent = "💀 GAME OVER... 💀";
        resultDesc.textContent = "残念...並び順が間違っています";
    }
}

function startListeningToHistory() {
    const historyRef = ref(db, `rooms/${currentRoomId}/history`);
    onValue(historyRef, (snapshot) => {
        const data = snapshot.val();
        historyList.innerHTML = "";
        if (!data) {
            historyList.innerHTML = "<p>まだ履歴はありません</p>";
            return;
        }
        const entries = Object.values(data).reverse();
        entries.forEach(entry => {
            const item = document.createElement('div');
            item.classList.add('history-item');
            const statusClass = entry.isSuccess ? 'success' : 'fail';
            const statusText = entry.isSuccess ? '成功' : '失敗';
            item.innerHTML = `
                <div class="history-header">
                    <span>${entry.theme}</span>
                    <span class="result-tag ${statusClass}">${statusText}</span>
                </div>
                <div class="history-details">${entry.resultDetails}</div>
            `;
            historyList.appendChild(item);
        });
    });
}