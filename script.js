const X_CLASS = "x";
const CIRCLE_CLASS = "circle";
const WINNING_COMBINATIONS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

// 位置价值：中心 4，角 3，边 2（AI 选步用）
const POSITION_SCORE = [3, 2, 3, 2, 4, 2, 3, 2, 3];

const bigBoard = document.getElementById("bigBoard");
const turnElement = document.getElementById("turn");
const restartButton = document.getElementById("restartButton");
const winningMessageElement = document.getElementById("winningMessage");
const winningMessageTextElement = document.querySelector(
  "[data-winning-message-text]"
);

const controlsElement = document.querySelector(".controls");
const pvpButton = document.getElementById("pvpButton");
const aiButton = document.getElementById("aiButton");
const tutorialButton = document.getElementById("tutorialButton");
const difficultyElement = document.getElementById("difficulty");
const difficultyButtons = document.querySelectorAll("#difficulty button");

const tutorialPanel = document.getElementById("tutorialPanel");
const tutorialText = document.getElementById("tutorialText");
const tutorialProgress = document.getElementById("tutorialProgress");
const tutorialNext = document.getElementById("tutorialNext");
const tutorialExit = document.getElementById("tutorialExit");

// boards[i] 表示第 i 个小棋盘
// element: 对应 DOM 节点
// cells:   该棋盘里 9 个格子的 DOM 节点
// state:   该棋盘 9 个格子的落子情况（null / "x" / "circle"）
// winner:  该小棋盘的胜负（null / "x" / "circle" / "draw"）
let boards = [];
let circleTurn;   // false 表示轮到 X，true 表示轮到 O
let activeBoard;  // 下一步必须落子的小棋盘编号 0-8；null 表示可以任意落子
let bigWinner;    // 整场游戏的胜负（null / "x" / "circle" / "draw"）
let gameMode = "pvp"; // "pvp" 双人 / "ai" 单人（电脑当 O） / "tutorial" 教程
let previousMode = "pvp"; // 进入教程前的模式，退出时恢复
let aiDifficulty = "medium"; // "easy" 简单 / "medium" 中等 / "hard" 困难

let tutorialIndex = 0;   // 当前教程到第几步
let stepFinished = false; // 当前教程步骤是否已完成正确操作

// 教程关卡数据：text 是操作前的解说；afterText 是正确操作后的补充说明
// marks 预置棋子；turn 轮到谁；activeBoard 高亮哪片棋盘；target 要求点哪个格子
const tutorialSteps = [
  {
    text: "欢迎！这是「终极井字棋」：一张 3×3 的大棋盘，每个大格子里还藏着一片小井字格，一共 9 片。你执 X、先手。点「下一步」开始。",
    marks: [],
    turn: "x",
    activeBoard: null,
    target: null,
  },
  {
    text: "第一手可以随便下。试试点正中间那片棋盘里、正中央那个绿色闪烁的格子（X 会落在这里）。",
    afterText: "漂亮！你把 X 下在了「正中央」。记住——你下在哪，就决定了对方下一手只能去哪片棋盘。",
    marks: [],
    turn: "x",
    activeBoard: null,
    target: { b: 4, c: 4 },
  },
  {
    text: "因为刚才下在了「正中央」，所以现在对方只能去大棋盘「正中央」的那片小井字格（它已经黄色高亮）。这是最重要的规则：位置决定下一片棋盘。点「下一步」。",
    marks: [{ b: 4, c: 4, m: "x" }],
    turn: "circle",
    activeBoard: 4,
    target: null,
  },
  {
    text: "现在你当 O。你只能在这片（正中央、黄色高亮）棋盘里落子。点左上角那个绿色闪烁的格子。",
    afterText: "做得好！你又下在了「左上角」——所以接下来 X 得去大棋盘「左上角」的那片棋盘。",
    marks: [{ b: 4, c: 4, m: "x" }],
    turn: "circle",
    activeBoard: 4,
    target: { b: 4, c: 0 },
  },
  {
    text: "最后学「怎么赢」：在一小片井字格里连成三子，这片棋盘就归你，并盖上大 X。看左上角棋盘，X 已经有两子了，点那个绿色闪烁的格子连成三子！",
    afterText: "恭喜！你刚赢了左上角整片棋盘（盖上了大 X）。谁先在大棋盘连成三片，就赢下整场。",
    marks: [
      { b: 0, c: 0, m: "x" },
      { b: 0, c: 1, m: "x" },
    ],
    turn: "x",
    activeBoard: 0,
    target: { b: 0, c: 2 },
  },
  {
    text: "搞定！规则回顾：① 你下在哪，对方就去哪片；② 那片满了/赢了就任意下；③ 连三子赢一片；④ 连三片赢整场。祝你玩得开心！",
    marks: [],
    turn: "x",
    activeBoard: null,
    target: null,
  },
];

buildBoard();
startGame();

bigBoard.addEventListener("click", handleClick);
restartButton.addEventListener("click", startGame);
pvpButton.addEventListener("click", () => setMode("pvp"));
aiButton.addEventListener("click", () => setMode("ai"));
tutorialButton.addEventListener("click", startTutorial);
tutorialNext.addEventListener("click", tutorialNextClick);
tutorialExit.addEventListener("click", exitTutorial);
difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    aiDifficulty = button.dataset.difficulty;
    difficultyButtons.forEach((b) => b.classList.toggle("active", b === button));
    if (gameMode === "ai") startGame();
  });
});

// 生成 9 个小棋盘，每个里面 9 个格子
function buildBoard() {
  for (let b = 0; b < 9; b++) {
    const boardElement = document.createElement("div");
    boardElement.classList.add("board");
    boardElement.dataset.board = b;

    const cells = [];
    for (let c = 0; c < 9; c++) {
      const cellElement = document.createElement("div");
      cellElement.classList.add("cell");
      cellElement.dataset.cell = c;
      boardElement.appendChild(cellElement);
      cells.push(cellElement);
    }

    bigBoard.appendChild(boardElement);
    boards.push({
      element: boardElement,
      cells,
      state: Array(9).fill(null),
      winner: null,
    });
  }
}

function startGame() {
  circleTurn = false;
  activeBoard = null;
  bigWinner = null;

  boards.forEach((board) => {
    board.state = Array(9).fill(null);
    board.winner = null;
  });

  winningMessageElement.classList.remove("show");
  render();
}

function setMode(mode) {
  gameMode = mode;
  pvpButton.classList.toggle("active", mode === "pvp");
  aiButton.classList.toggle("active", mode === "ai");
  difficultyElement.classList.toggle("hidden", mode !== "ai");
  startGame();
}

// —— 教程相关 ——
function startTutorial() {
  previousMode = gameMode;
  gameMode = "tutorial";
  tutorialIndex = 0;
  winningMessageElement.classList.remove("show");

  tutorialPanel.classList.remove("hidden");
  turnElement.classList.add("hidden");
  controlsElement.classList.add("hidden");
  difficultyElement.classList.add("hidden");

  loadTutorialStep();
}

function exitTutorial() {
  tutorialPanel.classList.add("hidden");
  turnElement.classList.remove("hidden");
  controlsElement.classList.remove("hidden");

  clearTutorialTarget();
  setMode(previousMode);
}

function loadTutorialStep() {
  const step = tutorialSteps[tutorialIndex];
  stepFinished = false;

  // 重置并摆放这一步需要的棋子
  boards.forEach((board) => {
    board.state = Array(9).fill(null);
    board.winner = null;
  });
  step.marks.forEach(({ b, c, m }) => {
    boards[b].state[c] = m;
  });

  circleTurn = step.turn === "circle";
  activeBoard = step.activeBoard;
  bigWinner = null;

  tutorialText.innerHTML = step.text;
  tutorialProgress.textContent = `步骤 ${tutorialIndex + 1}/${tutorialSteps.length}`;

  render();
  updateTutorialNav();
  renderTutorialTarget();
}

function tutorialNextClick() {
  const isLast = tutorialIndex === tutorialSteps.length - 1;
  if (isLast) {
    exitTutorial();
  } else {
    tutorialIndex++;
    loadTutorialStep();
  }
}

function updateTutorialNav() {
  const step = tutorialSteps[tutorialIndex];
  const isLast = tutorialIndex === tutorialSteps.length - 1;
  const waiting = Boolean(step.target) && !stepFinished;

  tutorialNext.classList.toggle("hidden", waiting);
  tutorialNext.textContent = isLast ? "开始游戏" : "下一步";
}

function renderTutorialTarget() {
  clearTutorialTarget();
  const step = tutorialSteps[tutorialIndex];
  if (step.target && !stepFinished) {
    boards[step.target.b].cells[step.target.c].classList.add("tutorial-target");
  }
}

function clearTutorialTarget() {
  document
    .querySelectorAll(".tutorial-target")
    .forEach((el) => el.classList.remove("tutorial-target"));
}

function handleTutorialClick(boardIndex, cellIndex) {
  const step = tutorialSteps[tutorialIndex];
  if (stepFinished) return; // 已完成，等点「下一步」
  if (!step.target) return; // 纯解说步骤，点棋盘不响应

  if (boardIndex !== step.target.b || cellIndex !== step.target.c) {
    // 点错了：短暂红一下提示
    const cellEl = boards[boardIndex].cells[cellIndex];
    cellEl.classList.add("wrong");
    setTimeout(() => cellEl.classList.remove("wrong"), 400);
    return;
  }

  // 正确：落下当前玩家的棋子
  const mark = circleTurn ? CIRCLE_CLASS : X_CLASS;
  boards[boardIndex].state[cellIndex] = mark;
  if (checkWin(boards[boardIndex].state, mark)) {
    boards[boardIndex].winner = mark;
  }

  stepFinished = true;
  render();
  renderTutorialTarget();
  if (step.afterText) {
    tutorialText.innerHTML = step.afterText;
  }
  updateTutorialNav();
}

function handleClick(e) {
  const cellElement = e.target.closest(".cell");
  if (!cellElement) return;

  const boardElement = cellElement.closest(".board");
  const boardIndex = Number(boardElement.dataset.board);
  const cellIndex = Number(cellElement.dataset.cell);

  if (gameMode === "tutorial") {
    handleTutorialClick(boardIndex, cellIndex);
    return;
  }

  const board = boards[boardIndex];

  // 各种不允许落子的情况
  if (bigWinner) return;                                  // 游戏已结束
  if (gameMode === "ai" && circleTurn) return;            // 电脑回合，忽略人的点击
  if (board.winner) return;                               // 这个小棋盘已分出胜负/平局
  if (board.state[cellIndex]) return;                     // 这个格子已经有棋子
  if (activeBoard !== null && activeBoard !== boardIndex) return; // 必须在指定棋盘落子

  makeMove(boardIndex, cellIndex);

  // 单人模式：人下完轮到电脑，隔一小会儿让电脑落子
  if (gameMode === "ai" && !bigWinner && circleTurn) {
    setTimeout(aiPlay, 400);
  }
}

// 统一下子逻辑（人和电脑共用），保证规则一致
function makeMove(boardIndex, cellIndex) {
  const board = boards[boardIndex];
  const currentClass = circleTurn ? CIRCLE_CLASS : X_CLASS;
  board.state[cellIndex] = currentClass;

  // 判断这个小棋盘是否分出胜负
  if (checkWin(board.state, currentClass)) {
    board.winner = currentClass;
  } else if (board.state.every((v) => v !== null)) {
    board.winner = "draw";
  }

  // 决定下一步必须落在哪个棋盘：刚才下子所在的「局部位置」编号
  const nextBoardIndex = cellIndex;
  if (boards[nextBoardIndex].winner) {
    activeBoard = null; // 目标棋盘已满/已结束，可任意落子
  } else {
    activeBoard = nextBoardIndex;
  }

  // 判断整场游戏：把 9 个小棋盘当成 9 个「大格子」来判胜负
  const bigState = boards.map((b) =>
    b.winner === X_CLASS ? X_CLASS : b.winner === CIRCLE_CLASS ? CIRCLE_CLASS : null
  );

  if (checkWin(bigState, currentClass)) {
    bigWinner = currentClass;
  } else if (boards.every((b) => b.winner !== null)) {
    bigWinner = "draw";
  }

  if (!bigWinner) {
    circleTurn = !circleTurn;
  }

  render();
}

function checkWin(state, currentClass) {
  return WINNING_COMBINATIONS.some((combination) =>
    combination.every((index) => state[index] === currentClass)
  );
}

// —— AI 对手（人机模式里当 O 的一方）——
function aiPlay() {
  if (bigWinner || gameMode !== "ai" || !circleTurn) return;
  const move = getBestMove();
  if (move) {
    makeMove(move.boardIndex, move.cellIndex);
  }
}

function getLegalMoves() {
  const moves = [];
  boards.forEach((board, boardIndex) => {
    if (board.winner) return; // 已分出胜负/平局的棋盘不能下
    if (activeBoard !== null && activeBoard !== boardIndex) return; // 不在指定棋盘
    board.state.forEach((value, cellIndex) => {
      if (!value) moves.push({ boardIndex, cellIndex });
    });
  });
  return moves;
}

function getBestMove() {
  const legal = getLegalMoves();
  if (legal.length === 0) return null;

  if (aiDifficulty === "easy") {
    return legal[Math.floor(Math.random() * legal.length)];
  }
  if (aiDifficulty === "hard") {
    return getHardMove(legal);
  }
  return getMediumMove(legal);
}

function getMediumMove(legal) {
  // 1) 能直接赢下一个小棋盘 → 果断赢
  for (const move of legal) {
    if (wouldWinBoard(move.boardIndex, move.cellIndex, CIRCLE_CLASS)) return move;
  }

  // 2) 能挡住玩家（X）在某片小棋盘三连 → 去堵
  for (const move of legal) {
    if (wouldWinBoard(move.boardIndex, move.cellIndex, X_CLASS)) return move;
  }

  // 3) 否则按评分选最有价值的一步
  let best = legal[0];
  let bestScore = -Infinity;
  for (const move of legal) {
    const score = scoreMove(move);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

function getHardMove(legal) {
  let best = legal[0];
  let bestScore = -Infinity;

  for (const move of legal) {
    let score = 0;
    const { boardIndex, cellIndex } = move;

    // 直接赢一片 / 挡住对手三连
    if (wouldWinBoard(boardIndex, cellIndex, CIRCLE_CLASS)) score += 100000;
    if (wouldWinBoard(boardIndex, cellIndex, X_CLASS)) score += 40000;

    // 位置价值 + 制造「双三」
    score += POSITION_SCORE[cellIndex] * 10;
    if (createsFork(boardIndex, cellIndex, CIRCLE_CLASS)) score += 8000;

    // 这步会把对手送到 cellIndex 号棋盘：别把他送进能立刻赢一片的棋盘
    const sentBoard = boards[cellIndex];
    if (sentBoard.winner) {
      score -= 30;
    } else if (boardHasWinningCell(cellIndex, X_CLASS)) {
      score -= 15000;
    }

    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

// 如果 mark 下在 (boardIndex, cellIndex) 能赢下那片小棋盘，返回 true
function wouldWinBoard(boardIndex, cellIndex, mark) {
  const state = boards[boardIndex].state.slice();
  state[cellIndex] = mark;
  return checkWin(state, mark);
}

// mark 下在 cellIndex 后，能在同一片棋盘里造出两个及以上「再下一子就三连」的点
function createsFork(boardIndex, cellIndex, mark) {
  const state = boards[boardIndex].state.slice();
  state[cellIndex] = mark;
  return countThreats(state, mark) >= 2;
}

// 某片棋盘里，是否存在 mark 再下一子就能三连的位置
function boardHasWinningCell(boardIndex, mark) {
  return countThreats(boards[boardIndex].state, mark) > 0;
}

function countThreats(state, mark) {
  let count = 0;
  for (let i = 0; i < 9; i++) {
    if (state[i]) continue;
    const copy = state.slice();
    copy[i] = mark;
    if (checkWin(copy, mark)) count++;
  }
  return count;
}

function scoreMove({ cellIndex }) {
  let score = POSITION_SCORE[cellIndex];

  // 这步会把对手「送」到 cellIndex 号棋盘：送进已结束的棋盘 = 给对手自由选择，略吃亏
  const sentBoard = boards[cellIndex];
  if (sentBoard.winner === X_CLASS || sentBoard.winner === CIRCLE_CLASS) {
    score -= 3;
  } else if (sentBoard.winner === "draw") {
    score -= 1;
  }

  return score;
}

function render() {
  const turnClass = circleTurn ? CIRCLE_CLASS : X_CLASS;

  boards.forEach((board, i) => {
    // 1) 渲染每个格子里的棋子
    board.cells.forEach((cellElement, c) => {
      cellElement.classList.remove(X_CLASS, CIRCLE_CLASS);
      const value = board.state[c];
      if (value) cellElement.classList.add(value);
    });

    // 2) 渲染小棋盘状态（胜负 + 高亮）
    board.element.classList.remove(
      X_CLASS,
      CIRCLE_CLASS,
      "active",
      "done",
      "won-x",
      "won-circle"
    );

    if (board.winner === X_CLASS) {
      board.element.classList.add("done", "won-x");
    } else if (board.winner === CIRCLE_CLASS) {
      board.element.classList.add("done", "won-circle");
    } else if (board.winner === "draw") {
      board.element.classList.add("done");
    }

    // 3) 还没结束的话，高亮「现在可以落子」的小棋盘
    if (!bigWinner && !board.winner) {
      const isActive = activeBoard === null ? true : activeBoard === i;
      if (isActive) {
        board.element.classList.add("active");
        // 只在轮到真人落子时显示悬停预览（电脑回合、教程里不显示）
        const showHover =
          gameMode === "pvp" || (gameMode === "ai" && !circleTurn);
        if (showHover) {
          board.element.classList.add(turnClass);
        }
      }
    }
  });

  // 4) 顶部提示与结束提示
  if (bigWinner) {
    if (bigWinner === "draw") {
      turnElement.textContent = "平局！";
      winningMessageTextElement.innerText = "平局！";
    } else {
      const winnerName = bigWinner === X_CLASS ? "X" : "O";
      turnElement.textContent = `${winnerName} 获胜！`;
      winningMessageTextElement.innerText = `${winnerName} 获胜！`;
    }
    winningMessageElement.classList.add("show");
  } else if (gameMode === "ai" && circleTurn) {
    turnElement.textContent = "轮到电脑（O）…";
  } else {
    const who = circleTurn ? "O" : "X";
    const hint = activeBoard === null ? "可以任意落子" : "请在黄色高亮的棋盘落子";
    turnElement.textContent = `轮到 ${who} — ${hint}`;
  }
}