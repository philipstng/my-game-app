const suits = ['♠', '♥', '♦', '♣'];
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

let deck = [], playerHand = [], dealerHand = [];
let bankroll = 1000, currentBet = 0, gameInProgress = false;

// win/loss tracking
let wins = 0, losses = 0, pushes = 0;

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
const simulateBtn = document.getElementById('simulate-btn');

const winRateEl = document.getElementById('win-rate');
const winsCountEl = document.getElementById('wins-count');
const lossesCountEl = document.getElementById('losses-count');
const pushesCountEl = document.getElementById('pushes-count');
const recommendationEl = document.getElementById('recommendation-value');

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
simulateBtn.addEventListener('click', () => simulateGames(100));

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
  updateRecommendation();
  updateUI();
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
  if (getHandValue(playerHand) > 21) {
    endHand('Player Busted! Dealer wins.', 'loss');
  } else {
    updateRecommendation();
  }
}

function stand() {
  while (getHandValue(dealerHand) < 17) { dealerHand.push(deck.pop()); }
  renderHands(true);

  const pVal = getHandValue(playerHand);
  const dVal = getHandValue(dealerHand);

  if (dVal > 21 || pVal > dVal) {
    bankroll += currentBet * 2;
    endHand('You Win!', 'win');
  } else if (pVal === dVal) {
    bankroll += currentBet;
    endHand('Push (Tie)!', 'push');
  } else {
    endHand('Dealer Wins!', 'loss');
  }
}

function doubleDown() {
  if (bankroll >= currentBet) {
    bankroll -= currentBet;
    currentBet *= 2;
    playerHand.push(deck.pop());
    renderHands(false);
    if (getHandValue(playerHand) <= 21) stand();
    else endHand('Player Busted on Double!', 'loss');
  }
}

function surrender() {
  bankroll += Math.floor(currentBet / 2);
  endHand('Player Surrendered.', 'loss');
}

function endHand(msg, outcome) {
  messageEl.textContent = msg;
  gameInProgress = false;
  currentBet = 0;
  betControls.classList.remove('hidden');
  actionControls.classList.add('hidden');
  if (outcome) recordOutcome(outcome);
  recommendationEl.textContent = '—';
  updateUI();
}

function updateUI() {
  bankrollEl.textContent = bankroll;
  currentBetEl.textContent = currentBet;
  dealBtn.disabled = currentBet === 0 || gameInProgress;
  simulateBtn.disabled = gameInProgress;
}

/* ---------------- Win/Loss tracking ---------------- */

function recordOutcome(outcome) {
  if (outcome === 'win') wins++;
  else if (outcome === 'loss') losses++;
  else if (outcome === 'push') pushes++;
  updateStatsDisplay();
}

function updateStatsDisplay() {
  const total = wins + losses + pushes;
  const rate = total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0';
  winRateEl.textContent = rate + '%';
  winsCountEl.textContent = wins;
  lossesCountEl.textContent = losses;
  pushesCountEl.textContent = pushes;
}

/* ---------------- Basic Strategy Recommendation Engine ----------------
   Based on standard multi-deck basic strategy (dealer stands on soft 17).
   Since this table has no Split control, pairs are evaluated under the
   normal hard/soft total rules. Options returned: 'Hit', 'Stand', 'Double Down'.
------------------------------------------------------------------------- */

function cardNumericValue(value) {
  if (value === 'A') return 11;
  if (['K', 'Q', 'J'].includes(value)) return 10;
  return parseInt(value);
}

// A hand is "soft" if an ace is currently being counted as 11.
function isSoftHand(hand, total) {
  const hasAce = hand.some(c => c.value === 'A');
  if (!hasAce) return false;
  let lowSum = 0;
  for (const c of hand) {
    if (c.value === 'A') lowSum += 1;
    else if (['K', 'Q', 'J'].includes(c.value)) lowSum += 10;
    else lowSum += parseInt(c.value);
  }
  return (lowSum + 10) === total;
}

function getBasicStrategyRecommendation(hand, dealerUpCard, canDouble) {
  const total = getHandValue(hand);
  const dealerVal = cardNumericValue(dealerUpCard.value);
  const soft = isSoftHand(hand, total);

  if (soft) {
    if (total >= 19) return 'Stand';                              // A,8 / A,9 / blackjack
    if (total === 18) {                                            // A,7
      if (dealerVal >= 2 && dealerVal <= 6) return canDouble ? 'Double Down' : 'Stand';
      if (dealerVal === 7 || dealerVal === 8) return 'Stand';
      return 'Hit';                                                 // vs 9,10,A
    }
    if (total === 17) {                                            // A,6
      return (dealerVal >= 3 && dealerVal <= 6 && canDouble) ? 'Double Down' : 'Hit';
    }
    if (total === 15 || total === 16) {                            // A,4 / A,5
      return (dealerVal >= 4 && dealerVal <= 6 && canDouble) ? 'Double Down' : 'Hit';
    }
    if (total === 13 || total === 14) {                            // A,2 / A,3
      return (dealerVal >= 5 && dealerVal <= 6 && canDouble) ? 'Double Down' : 'Hit';
    }
    return 'Hit';
  } else {
    if (total >= 17) return 'Stand';
    if (total >= 13 && total <= 16) return (dealerVal >= 2 && dealerVal <= 6) ? 'Stand' : 'Hit';
    if (total === 12) return (dealerVal >= 4 && dealerVal <= 6) ? 'Stand' : 'Hit';
    if (total === 11) return (canDouble && dealerVal <= 10) ? 'Double Down' : 'Hit';
    if (total === 10) return (canDouble && dealerVal <= 9) ? 'Double Down' : 'Hit';
    if (total === 9) return (canDouble && dealerVal >= 3 && dealerVal <= 6) ? 'Double Down' : 'Hit';
    return 'Hit'; // 8 or less
  }
}

function updateRecommendation() {
  if (!gameInProgress || !dealerHand.length) {
    recommendationEl.textContent = '—';
    return;
  }
  const canDouble = playerHand.length === 2 && bankroll >= currentBet;
  const rec = getBasicStrategyRecommendation(playerHand, dealerHand[0], canDouble);
  recommendationEl.textContent = rec === 'Double Down' ? 'DD' : rec;
}

/* ---------------- Simulator ---------------- */

function simulateGames(numGames) {
  if (gameInProgress) return;
  simulateBtn.disabled = true;

  let simWins = 0, simLosses = 0, simPushes = 0, played = 0;
  const bet = 25;

  for (let g = 0; g < numGames; g++) {
    if (bankroll < bet) break;
    bankroll -= bet;
    let betAmount = bet;

    buildDeck();
    let pHand = [deck.pop(), deck.pop()];
    let dHand = [deck.pop(), deck.pop()];
    let busted = false;

    while (true) {
      const canDbl = pHand.length === 2 && bankroll >= betAmount;
      const rec = getBasicStrategyRecommendation(pHand, dHand[0], canDbl);

      if (rec === 'Double Down' && canDbl) {
        bankroll -= betAmount;
        betAmount *= 2;
        pHand.push(deck.pop());
        if (getHandValue(pHand) > 21) busted = true;
        break;
      } else if (rec === 'Hit') {
        pHand.push(deck.pop());
        if (getHandValue(pHand) > 21) { busted = true; break; }
      } else {
        break; // Stand
      }
    }

    if (!busted) {
      while (getHandValue(dHand) < 17) dHand.push(deck.pop());
      const pVal = getHandValue(pHand), dVal = getHandValue(dHand);
      if (dVal > 21 || pVal > dVal) { bankroll += betAmount * 2; simWins++; }
      else if (pVal === dVal) { bankroll += betAmount; simPushes++; }
      else { simLosses++; }
    } else {
      simLosses++;
    }
    played++;
  }

  wins += simWins;
  losses += simLosses;
  pushes += simPushes;
  updateStatsDisplay();

  messageEl.textContent = played < numGames
    ? `Ran out of bankroll after ${played} games: ${simWins}W / ${simLosses}L / ${simPushes}P`
    : `Simulated ${played} games: ${simWins}W / ${simLosses}L / ${simPushes}P`;

  updateUI();
  simulateBtn.disabled = gameInProgress;
}

/* ---------------- Init ---------------- */
updateStatsDisplay();
updateRecommendation();
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
