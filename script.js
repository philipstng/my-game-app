const suits = ['♠', '♥', '♦', '♣'];
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

let deck = [], playerHand = [], dealerHand = [];
let bankroll = 1000, currentBet = 0, gameInProgress = false;

const bankrollEl = document.getElementById('bankroll');
const currentBetEl = document.getElementById('current-bet');
const messageEl = document.getElementById('message');
const playerCardsEl = document.getElementById('player-cards');
const dealerCardsEl = document.getElementById('dealer-cards');
const playerScoreEl = document.getElementById('player-score');
const dealerScoreEl = document.getElementById('dealer-score');

const betControls = document.getElementById('bet-controls');
const actionControls = document.getElementById('action-controls');
const dealBtn = document.getElementById('deal-btn');

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const amount = parseInt(chip.dataset.amount);
    if (bankroll >= amount) {
      bankroll -= amount;
      currentBet += amount;
      updateUI();
    }
  });
});

document.getElementById('clear-bet-btn').addEventListener('click', () => {
  bankroll += currentBet;
  currentBet = 0;
  updateUI();
});

dealBtn.addEventListener('click', startHand);
document.getElementById('hit-btn').addEventListener('click', hit);
document.getElementById('stand-btn').addEventListener('click', stand);
document.getElementById('double-btn').addEventListener('click', doubleDown);
document.getElementById('surrender-btn').addEventListener('click', surrender);

function buildDeck() {
  deck = [];
  for (let suit of suits) {
    for (let value of values) {
      deck.push({ suit, value });
    }
  }
  deck.sort(() => Math.random() - 0.5);
}

function getHandValue(hand) {
  let value = 0, aces = 0;
  for (let card of hand) {
    if (card.value === 'A') { aces++; value += 11; }
    else if (['K', 'Q', 'J'].includes(card.value)) { value += 10; }
    else { value += parseInt(card.value); }
  }
  while (value > 21 && aces > 0) { value -= 10; aces--; }
  return value;
}

function startHand() {
  if (currentBet === 0) return;
  buildDeck();
  playerHand = [deck.pop(), deck.pop()];
  dealerHand = [deck.pop(), deck.pop()];
  gameInProgress = true;
  
  betControls.classList.add('hidden');
  actionControls.classList.remove('hidden');
  messageEl.textContent = 'Hit or Stand?';
  renderHands(false);
}

function renderHands(showDealer) {
  playerCardsEl.innerHTML = playerHand.map(c => renderCard(c)).join('');
  playerScoreEl.textContent = getHandValue(playerHand);

  if (showDealer) {
    dealerCardsEl.innerHTML = dealerHand.map(c => renderCard(c)).join('');
    dealerScoreEl.textContent = getHandValue(dealerHand);
  } else {
    dealerCardsEl.innerHTML = renderCard(dealerHand[0]) + `<div class="card back"></div>`;
    dealerScoreEl.textContent = '?';
  }
}

function renderCard(card) {
  const isRed = ['♥', '♦'].includes(card.suit);
  return `<div class="card ${isRed ? 'red' : ''}"><div>${card.value}</div><div>${card.suit}</div></div>`;
}

function hit() {
  playerHand.push(deck.pop());
  renderHands(false);
  if (getHandValue(playerHand) > 21) endHand('Player Busted! Dealer wins.');
}

function stand() {
  while (getHandValue(dealerHand) < 17) { dealerHand.push(deck.pop()); }
  renderHands(true);
  
  const pVal = getHandValue(playerHand);
  const dVal = getHandValue(dealerHand);

  if (dVal > 21 || pVal > dVal) {
    bankroll += currentBet * 2;
    endHand('You Win!');
  } else if (pVal === dVal) {
    bankroll += currentBet;
    endHand('Push (Tie)!');
  } else {
    endHand('Dealer Wins!');
  }
}

function doubleDown() {
  if (bankroll >= currentBet) {
    bankroll -= currentBet;
    currentBet *= 2;
    playerHand.push(deck.pop());
    renderHands(false);
    if (getHandValue(playerHand) <= 21) stand();
    else endHand('Player Busted on Double!');
  }
}

function surrender() {
  bankroll += Math.floor(currentBet / 2);
  endHand('Player Surrendered.');
}

function endHand(msg) {
  messageEl.textContent = msg;
  gameInProgress = false;
  currentBet = 0;
  betControls.classList.remove('hidden');
  actionControls.classList.add('hidden');
  updateUI();
}

function updateUI() {
  bankrollEl.textContent = bankroll;
  currentBetEl.textContent = currentBet;
  dealBtn.disabled = currentBet === 0 || gameInProgress;
}
