const storageKeys = {
  cards: "studysprint-cards",
  tasks: "studysprint-tasks",
  notes: "studysprint-notes",
  focus: "studysprint-focus-count"
};

const sampleCards = [
  {
    id: crypto.randomUUID(),
    deck: "Английски",
    question: "Какво означава resilient?",
    answer: "Устойчив, гъвкав при трудности.",
    hard: false
  },
  {
    id: crypto.randomUUID(),
    deck: "Биология",
    question: "Каква е ролята на митохондриите?",
    answer: "Произвеждат енергия за клетката.",
    hard: true
  }
];

const state = {
  cards: loadJson(storageKeys.cards, sampleCards),
  tasks: loadJson(storageKeys.tasks, []),
  notes: localStorage.getItem(storageKeys.notes) || "",
  focusCount: Number(localStorage.getItem(storageKeys.focus) || 0),
  currentDeck: "all",
  currentIndex: 0,
  quizIndex: null,
  quizScore: 0,
  quizTotal: 0,
  quizFeedback: "",
  timer: {
    duration: 25 * 60,
    remaining: 25 * 60,
    intervalId: null
  }
};

const elements = {
  form: document.getElementById("flashcard-form"),
  deckInput: document.getElementById("deck-input"),
  questionInput: document.getElementById("question-input"),
  answerInput: document.getElementById("answer-input"),
  deckFilter: document.getElementById("deck-filter"),
  flashcardView: document.getElementById("flashcard-view"),
  flashcardFrontTitle: document.querySelector(".flashcard-front h3"),
  flashcardFrontText: document.querySelector(".flashcard-front p"),
  flashcardBackText: document.querySelector(".flashcard-back p"),
  cardList: document.getElementById("card-list"),
  prevCard: document.getElementById("prev-card"),
  nextCard: document.getElementById("next-card"),
  flipCard: document.getElementById("flip-card"),
  markHard: document.getElementById("mark-hard"),
  shuffleBtn: document.getElementById("shuffle-btn"),
  statCards: document.getElementById("stat-cards"),
  statDecks: document.getElementById("stat-decks"),
  statHard: document.getElementById("stat-hard"),
  progressFill: document.getElementById("progress-fill"),
  progressText: document.getElementById("progress-text"),
  focusCount: document.getElementById("focus-count"),
  nextTask: document.getElementById("next-task"),
  quizQuestion: document.getElementById("quiz-question"),
  quizAnswer: document.getElementById("quiz-answer"),
  quizFeedback: document.getElementById("quiz-feedback"),
  quizScore: document.getElementById("quiz-score"),
  quizTotal: document.getElementById("quiz-total"),
  checkAnswer: document.getElementById("check-answer"),
  newQuiz: document.getElementById("new-quiz"),
  timerDisplay: document.getElementById("timer-display"),
  startTimer: document.getElementById("start-timer"),
  pauseTimer: document.getElementById("pause-timer"),
  resetTimer: document.getElementById("reset-timer"),
  taskForm: document.getElementById("task-form"),
  taskInput: document.getElementById("task-input"),
  taskList: document.getElementById("task-list"),
  notesArea: document.getElementById("notes-area")
};

function loadJson(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getFilteredCards() {
  if (state.currentDeck === "all") return state.cards;
  return state.cards.filter((card) => card.deck === state.currentDeck);
}

function updateDeckFilter() {
  const decks = [...new Set(state.cards.map((card) => card.deck))].sort((a, b) => a.localeCompare(b, "bg"));
  const currentValue = state.currentDeck;
  elements.deckFilter.innerHTML = '<option value="all">Всички теми</option>';

  decks.forEach((deck) => {
    const option = document.createElement("option");
    option.value = deck;
    option.textContent = deck;
    if (deck === currentValue) option.selected = true;
    elements.deckFilter.appendChild(option);
  });
}

function renderFlashcard() {
  const cards = getFilteredCards();
  elements.flashcardView.classList.remove("flipped");

  if (!cards.length) {
    elements.flashcardView.classList.add("empty");
    elements.flashcardFrontTitle.textContent = "Няма карти в тази тема";
    elements.flashcardFrontText.textContent = "Създай нова карта или избери друга тема.";
    elements.flashcardBackText.textContent = "";
    return;
  }

  elements.flashcardView.classList.remove("empty");
  state.currentIndex = Math.max(0, Math.min(state.currentIndex, cards.length - 1));
  const currentCard = cards[state.currentIndex];
  elements.flashcardFrontTitle.textContent = currentCard.question;
  elements.flashcardFrontText.textContent = `Тема: ${currentCard.deck}`;
  elements.flashcardBackText.textContent = currentCard.answer;
  elements.markHard.textContent = currentCard.hard ? "Премахни трудно" : "Маркирай трудно";
}

function renderCardList() {
  if (!state.cards.length) {
    elements.cardList.innerHTML = "";
    return;
  }

  elements.cardList.innerHTML = state.cards
    .map((card) => `
      <article class="card-item">
        <div class="tag-row">
          <span>${escapeHtml(card.deck)}</span>
          ${card.hard ? '<span class="hard-tag">Трудно</span>' : "<span>Нормално</span>"}
        </div>
        <h4>${escapeHtml(card.question)}</h4>
        <p>${escapeHtml(card.answer)}</p>
      </article>
    `)
    .join("");
}

function renderStats() {
  const deckCount = new Set(state.cards.map((card) => card.deck)).size;
  const hardCount = state.cards.filter((card) => card.hard).length;
  const completedTasks = state.tasks.filter((task) => task.done).length;
  const totalGoalUnits = Math.max(1, state.cards.length + state.tasks.length + 2);
  const achieved = hardCount + completedTasks + state.focusCount;
  const progress = Math.min(100, Math.round((achieved / totalGoalUnits) * 100));

  elements.statCards.textContent = state.cards.length;
  elements.statDecks.textContent = deckCount;
  elements.statHard.textContent = hardCount;
  elements.progressFill.style.width = `${progress}%`;
  elements.progressText.textContent = `${progress}% от днешната учебна цел е изпълнена.`;
  elements.focusCount.textContent = state.focusCount;

  const nextPending = state.tasks.find((task) => !task.done);
  elements.nextTask.textContent = nextPending ? nextPending.text : "Всичко е отметнато";
}

function renderQuiz() {
  const cards = getFilteredCards();
  elements.quizTotal.textContent = state.quizTotal;
  elements.quizScore.textContent = state.quizScore;

  if (!cards.length) {
    state.quizIndex = null;
    elements.quizQuestion.textContent = "Няма достатъчно карти за тест.";
    elements.quizFeedback.textContent = "Добави поне 1 карта, за да започнеш.";
    return;
  }

  if (state.quizIndex === null || state.quizIndex >= cards.length) {
    state.quizIndex = Math.floor(Math.random() * cards.length);
  }

  elements.quizQuestion.textContent = cards[state.quizIndex].question;
  elements.quizFeedback.textContent = state.quizFeedback || "Опитай да отговориш със свои думи.";
}

function renderTasks() {
  elements.taskList.innerHTML = state.tasks
    .map((task) => `
      <li class="${task.done ? "done" : ""}" data-id="${task.id}">
        <input type="checkbox" ${task.done ? "checked" : ""} aria-label="Маркирай задача">
        <span>${escapeHtml(task.text)}</span>
        <button type="button">X</button>
      </li>
    `)
    .join("");
}

function renderTimer() {
  const minutes = String(Math.floor(state.timer.remaining / 60)).padStart(2, "0");
  const seconds = String(state.timer.remaining % 60).padStart(2, "0");
  elements.timerDisplay.textContent = `${minutes}:${seconds}`;
}

function syncNotes() {
  elements.notesArea.value = state.notes;
}

function persistAll() {
  saveJson(storageKeys.cards, state.cards);
  saveJson(storageKeys.tasks, state.tasks);
  localStorage.setItem(storageKeys.notes, state.notes);
  localStorage.setItem(storageKeys.focus, String(state.focusCount));
}

function refreshUI() {
  updateDeckFilter();
  renderFlashcard();
  renderCardList();
  renderStats();
  renderQuiz();
  renderTasks();
  renderTimer();
  syncNotes();
}

function normalizeText(text) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();

  state.cards.unshift({
    id: crypto.randomUUID(),
    deck: elements.deckInput.value.trim(),
    question: elements.questionInput.value.trim(),
    answer: elements.answerInput.value.trim(),
    hard: false
  });

  state.currentDeck = "all";
  state.currentIndex = 0;
  persistAll();
  refreshUI();
  elements.form.reset();
});

elements.deckFilter.addEventListener("change", (event) => {
  state.currentDeck = event.target.value;
  state.currentIndex = 0;
  state.quizIndex = null;
  state.quizFeedback = "";
  renderFlashcard();
  renderQuiz();
});

elements.flipCard.addEventListener("click", () => {
  if (!getFilteredCards().length) return;
  elements.flashcardView.classList.toggle("flipped");
});

elements.flashcardView.addEventListener("click", () => {
  if (!getFilteredCards().length) return;
  elements.flashcardView.classList.toggle("flipped");
});

elements.prevCard.addEventListener("click", () => {
  const cards = getFilteredCards();
  if (!cards.length) return;
  state.currentIndex = (state.currentIndex - 1 + cards.length) % cards.length;
  renderFlashcard();
});

elements.nextCard.addEventListener("click", () => {
  const cards = getFilteredCards();
  if (!cards.length) return;
  state.currentIndex = (state.currentIndex + 1) % cards.length;
  renderFlashcard();
});

elements.markHard.addEventListener("click", () => {
  const cards = getFilteredCards();
  if (!cards.length) return;
  const card = cards[state.currentIndex];
  const original = state.cards.find((entry) => entry.id === card.id);
  original.hard = !original.hard;
  persistAll();
  refreshUI();
});

elements.shuffleBtn.addEventListener("click", () => {
  state.cards = [...state.cards].sort(() => Math.random() - 0.5);
  state.currentIndex = 0;
  persistAll();
  refreshUI();
});

elements.checkAnswer.addEventListener("click", () => {
  const cards = getFilteredCards();
  if (!cards.length) return;

  const currentCard = cards[state.quizIndex];
  const userAnswer = normalizeText(elements.quizAnswer.value);
  const expected = normalizeText(currentCard.answer);
  const isCorrect = userAnswer && (expected.includes(userAnswer) || userAnswer.includes(expected));

  state.quizTotal += 1;
  if (isCorrect) {
    state.quizScore += 1;
    state.quizFeedback = "Точно така. Продължавай.";
  } else {
    state.quizFeedback = `Почти. Очакван отговор: ${currentCard.answer}`;
  }

  elements.quizAnswer.value = "";
  state.quizIndex = Math.floor(Math.random() * cards.length);
  renderQuiz();
});

elements.newQuiz.addEventListener("click", () => {
  state.quizIndex = null;
  state.quizFeedback = "";
  renderQuiz();
});

elements.startTimer.addEventListener("click", () => {
  if (state.timer.intervalId) return;

  state.timer.intervalId = setInterval(() => {
    state.timer.remaining -= 1;
    renderTimer();

    if (state.timer.remaining <= 0) {
      clearInterval(state.timer.intervalId);
      state.timer.intervalId = null;
      state.timer.remaining = state.timer.duration;
      state.focusCount += 1;
      persistAll();
      renderStats();
      renderTimer();
      window.alert("Pomodoro сесията приключи. Време е за кратка почивка.");
    }
  }, 1000);
});

elements.pauseTimer.addEventListener("click", () => {
  if (!state.timer.intervalId) return;
  clearInterval(state.timer.intervalId);
  state.timer.intervalId = null;
});

elements.resetTimer.addEventListener("click", () => {
  if (state.timer.intervalId) {
    clearInterval(state.timer.intervalId);
    state.timer.intervalId = null;
  }
  state.timer.remaining = state.timer.duration;
  renderTimer();
});

elements.taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.tasks.push({
    id: crypto.randomUUID(),
    text: elements.taskInput.value.trim(),
    done: false
  });
  elements.taskInput.value = "";
  persistAll();
  renderTasks();
  renderStats();
});

elements.taskList.addEventListener("click", (event) => {
  const listItem = event.target.closest("li");
  if (!listItem) return;
  const taskId = listItem.dataset.id;
  const task = state.tasks.find((entry) => entry.id === taskId);
  if (!task) return;

  if (event.target.matches('input[type="checkbox"]')) {
    task.done = event.target.checked;
  }

  if (event.target.matches("button")) {
    state.tasks = state.tasks.filter((entry) => entry.id !== taskId);
  }

  persistAll();
  renderTasks();
  renderStats();
});

elements.notesArea.addEventListener("input", (event) => {
  state.notes = event.target.value;
  localStorage.setItem(storageKeys.notes, state.notes);
});

refreshUI();
