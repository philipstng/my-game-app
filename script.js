// --- SOUND SYNTHESIS ENGINE (Web Audio API) ---
let soundEnabled = true;
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'chip') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
    } else if (type === 'card') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'win') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
    } else if (type === 'lose') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(120, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    document.getElementById('soundToggleBtn').innerText = soundEnabled ? '🔊 ON' : '🔇 OFF';
}

// --- GAME STATE VARIABLES ---
const suits = [
    { name: 'hearts', symbol: '♥', color: 'text-red-600' },
    { name: 'diamonds', symbol: '♦', color: 'text-red-600' },
    { name: 'clubs', symbol: '♣', color: 'text-slate-900' },
    { name: 'spades', symbol: '♠', color: 'text-slate-900' }
];

const values = [
    { code: '2', val: 2 }, { code: '3', val: 3 }, { code: '4', val: 4 },
    { code: '5', val: 5 }, { code: '6', val: 6 }, { code: '7', val: 7 },
    { code: '8', val: 8 }, { code: '9', val: 9 }, { code: '10', val: 10 },
    { code: 'J', val: 10 }, { code: 'Q', val: 10 }, { code: 'K', val: 10 },
    { code: 'A', val: 11 }
];

let deck = [];
let playerHand = [];
let dealerHand = [];
let balance = 1000;
let currentBet = 0;
let gameState = 'BETTING';
let wins = 0;
let losses = 0;
let pushes = 0;

// --- BLACKJACK STRATEGY RECOMMENDATION ALGORITHM ---
const strategyRationale = {
    'hard_5_9': 'Always hit - low total needs improvement',
    'hard_10_12': 'Hit against dealer 7-A, stand against 2-6',
    'hard_13_16': 'Stand against dealer 2-6, hit against 7-A',
    'hard_17+': 'Always stand - strong hand',
    'soft_13_15': 'Hit against dealer 7-A, double 13-15 vs 5-6',
    'soft_16_18': 'Double against dealer 4-6, hit against 7-A, stand vs 2-3',
    'soft_19+': 'Always stand - very strong soft hand',
    'pair_10': 'Always stand on 20',
    'pair_9': 'Stand against dealer 7-A, split vs 2-6,9',
    'pair_8': 'Always split eights',
    'pair_7': 'Split vs 2-7, stand vs 8-A',
    'pair_6': 'Split vs 2-6, hit vs 7-A',
    'pair_5': 'Double vs 2-9, hit vs 10-A',
    'pair_4': 'Split vs 5-6, hit otherwise',
    'pair_3_2': 'Split vs 2-7, hit vs 8-A',
    'always_hit': 'Hit - hand needs improvement',
    'always_stand': 'Stand - good chance to win'
};

function getRecommendation(playerHand, dealerUpcard) {
    if (gameState !== 'PLAYING' || !dealerUpcard || dealerUpcard.hidden) {
        return { action: 'Wait', rationale: 'Place your bet and start the game' };
    }

    const playerScore = calculateScore(playerHand);
    const dealerValue = dealerUpcard.val;
    const playerCards = playerHand.map(c => c.code);

    if (playerHand.length === 2 && playerCards[0] === playerCards[1]) {
        return getPairRecommendation(playerCards[0], dealerValue);
    }

    const hasAce = playerHand.some(c => c.code === 'A');
    const aceCount = playerHand.filter(c => c.code === 'A').length;
    const nonAceScore = playerHand.filter(c => c.code !== 'A').reduce((sum, c) => sum + c.val, 0);

    if (hasAce && playerScore <= 21) {
        return getSoftHandRecommendation(playerScore, nonAceScore, dealerValue, aceCount);
    }

    return getHardHandRecommendation(playerScore, dealerValue, playerHand.length);
}

function getHardHandRecommendation(score, dealerValue, handLength) {
    if (score >= 17) {
        return { action: 'Stand', rationale: strategyRationale['hard_17+'] };
    }

    if (score >= 13 && score <= 16) {
        if (dealerValue >= 2 && dealerValue <= 6) {
            return { action: 'Stand', rationale: strategyRationale['hard_13_16'] + ' (dealer has weak upcard)' };
        } else {
            return { action: 'Hit', rationale: strategyRationale['hard_13_16'] + ' (dealer has strong upcard)' };
        }
    }

    if (score >= 10 && score <= 12) {
        if (dealerValue >= 2 && dealerValue <= 6) {
            if (handLength === 2) {
                return { action: 'Double', rationale: strategyRationale['hard_10_12'] + ' - double down on weak dealer upcard' };
            }
            return { action: 'Hit', rationale: strategyRationale['hard_10_12'] };
        } else if (dealerValue >= 7 && dealerValue <= 9) {
            if ((score === 10 || score === 11) && handLength === 2) {
                return { action: 'Double', rationale: 'Double down - good hand vs medium dealer card' };
            }
            return { action: 'Hit', rationale: strategyRationale['hard_10_12'] };
        }
        return { action: 'Hit', rationale: strategyRationale['hard_10_12'] };
    }

    if (score >= 5 && score <= 9) {
        return { action: 'Hit', rationale: strategyRationale['hard_5_9'] };
    }

    return { action: 'Hit', rationale: strategyRationale['always_hit'] };
}

function getSoftHandRecommendation(score, nonAceScore, dealerValue, aceCount) {
    if (score >= 19) {
        return { action: 'Stand', rationale: strategyRationale['soft_19+'] };
    }

    if (score >= 17 && score <= 18) {
        if (dealerValue >= 2 && dealerValue <= 3) {
            return { action: 'Stand', rationale: strategyRationale['soft_16_18'] + ' (vs dealer 2-3)' };
        } else if (dealerValue >= 4 && dealerValue <= 6) {
            return { action: 'Double', rationale: strategyRationale['soft_16_18'] + ' (double vs 4-6)' };
        } else {
            return { action: 'Hit', rationale: strategyRationale['soft_16_18'] + ' (vs dealer 7-A)' };
        }
    }

    if (score === 16) {
        if (dealerValue >= 2 && dealerValue <= 3) {
            return { action: 'Stand', rationale: strategyRationale['soft_16_18'] + ' (vs dealer 2-3)' };
        } else if (dealerValue >= 4 && dealerValue <= 6) {
            return { action: 'Double', rationale: strategyRationale['soft_16_18'] + ' (double vs 4-6)' };
        } else {
            return { action: 'Hit', rationale: strategyRationale['soft_16_18'] + ' (vs dealer 7-A)' };
        }
    }

    if (score >= 13 && score <= 15) {
        if (dealerValue >= 5 && dealerValue <= 6) {
            return { action: 'Double', rationale: strategyRationale['soft_13_15'] + ' (double vs 5-6)' };
        } else if (dealerValue >= 2 && dealerValue <= 4) {
            return { action: 'Hit', rationale: strategyRationale['soft_13_15'] + ' (hit vs 2-4)' };
        } else {
            return { action: 'Hit', rationale: strategyRationale['soft_13_15'] + ' (hit vs 7-A)' };
        }
    }

    return { action: 'Hit', rationale: strategyRationale['always_hit'] };
}

function getPairRecommendation(cardCode, dealerValue) {
    switch(cardCode) {
        case 'A':
        case '10':
        case 'K':
        case 'Q':
        case 'J':
            return { action: 'Stand', rationale: strategyRationale['pair_10'] };
        case '9':
            if (dealerValue >= 2 && dealerValue <= 6 || dealerValue === 8 || dealerValue === 9) {
                return { action: 'Split', rationale: 'Split nines vs dealer 2-6,8-9' };
            }
            return { action: 'Stand', rationale: strategyRationale['pair_9'] };
        case '8':
            return { action: 'Split', rationale: strategyRationale['pair_8'] };
        case '7':
            if (dealerValue >= 2 && dealerValue <= 7) {
                return { action: 'Split', rationale: strategyRationale['pair_7'] + ' (vs 2-7)' };
            }
            return { action: 'Stand', rationale: strategyRationale['pair_7'] + ' (vs 8-A)' };
        case '6':
            if (dealerValue >= 2 && dealerValue <= 6) {
                return { action: 'Split', rationale: strategyRationale['pair_6'] };
            }
            return { action: 'Hit', rationale: strategyRationale['pair_6'] + ' (vs 7-A)' };
        case '5':
            if (dealerValue >= 2 && dealerValue <= 9) {
                return { action: 'Double', rationale: strategyRationale['pair_5'] };
            }
            return { action: 'Hit', rationale: strategyRationale['pair_5'] + ' (vs 10-A)' };
        case '4':
            if (dealerValue === 5 || dealerValue === 6) {
                return { action: 'Split', rationale: strategyRationale['pair_4'] };
            }
            return { action: 'Hit', rationale: strategyRationale['pair_4'] };
        case '3':
        case '2':
            if (dealerValue >= 2 && dealerValue <= 7) {
                return { action: 'Split', rationale: strategyRationale['pair_3_2'] };
            }
            return { action: 'Hit', rationale: strategyRationale['pair_3_2'] + ' (vs 8-A)' };
        default:
            return { action: 'Hit', rationale: strategyRationale['always_hit'] };
    }
}

function updateRecommendation() {
    const dealerUpcard = dealerHand.find(c => !c.hidden);
    const recommendation = getRecommendation(playerHand, dealerUpcard);

    document.getElementById('recommendationText').textContent = recommendation.action;
    document.getElementById('rationaleText').textContent = recommendation.rationale;

    const recElement = document.getElementById('recommendationText');
    recElement.className = 'text-sm sm\:text-base font-bold text-center';

    if (recommendation.action === 'Stand') {
        recElement.classList.add('text-amber-400');
    } else if (recommendation.action === 'Hit') {
        recElement.classList.add('text-emerald-400');
    } else if (recommendation.action === 'Double') {
        recElement.classList.add('text-purple-400');
    } else if (recommendation.action === 'Split') {
        recElement.classList.add('text-indigo-400');
    } else {
        recElement.classList.add('text-slate-200');
    }
}

// --- DECK MANAGEMENT ---
function createDeck() {
    deck = [];
    for (let d = 0; d < 6; d++) {
        for (let suit of suits) {
            for (let val of values) {
                deck.push({ ...val, suit });
            }
        }
    }
    shuffleDeck();
}

function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function drawCard() {
    if (deck.length < 30) createDeck();
    return deck.pop();
}

// --- HAND SCORE CALCULATOR ---
function calculateScore(hand) {
    let score = 0;
    let aces = 0;

    for (let card of hand) {
        if (card.hidden) continue;
        score += card.val;
        if (card.code === 'A') aces++;
    }

    while (score > 21 && aces > 0) {
        score -= 10;
        aces--;
    }

    return score;
}

function isSoft17(hand) {
    let score = 0;
    let aces = 0;
    for (let card of hand) {
        score += card.val;
        if (card.code === 'A') aces++;
    }
    return score === 17 && aces > 0;
}

// --- WIN-LOSS TRACKING ---
function updateWinRate() {
    const totalGames = wins + losses + pushes;
    const winPercentage = totalGames > 0 ? (wins / totalGames * 100).toFixed(2) : 0.00;
    document.getElementById('winRateDisplay').textContent =
        `${winPercentage}% (${wins}-${losses}-${pushes})`;
}

function logResult(result) {
    if (result === 'WIN' || result === 'BLACKJACK') {
        wins++;
    } else if (result === 'LOSE' || result === 'BUST') {
        losses++;
    } else if (result === 'PUSH' || result === 'SURRENDER') {
        pushes++;
    }
    updateWinRate();
}

// --- BETTING CONTROLS ---
function addBet(amount) {
    if (gameState !== 'BETTING') return;
    if (balance >= amount) {
        balance -= amount;
        currentBet += amount;
        updateUI();
        playSound('chip');
    }
}

function clearBet() {
    if (gameState !== 'BETTING') return;
    balance += currentBet;
    currentBet = 0;
    updateUI();
    playSound('chip');
}

// --- GAME ACTIONS ---
function startDeal() {
    if (currentBet === 0) {
        showMessage('Please place a bet first!', 'bg-amber-500 text-slate-950');
        return;
    }

    hideMessage();
    gameState = 'PLAYING';
    playerHand = [];
    dealerHand = [];

    playerHand.push(drawCard());
    dealerHand.push(drawCard());
    playerHand.push(drawCard());

    const hiddenCard = drawCard();
    hiddenCard.hidden = true;
    dealerHand.push(hiddenCard);

    renderHands();
    updateUI();
    updateRecommendation();
    playSound('card');

    const playerVal = calculateScore(playerHand);
    if (playerVal === 21) {
        dealerHand[1].hidden = false;
        renderHands();
        const dealerVal = calculateScore(dealerHand);
        if (dealerVal === 21) {
            balance += currentBet;
            endHand('PUSH', 'Both have Blackjack! Push.');
        } else {
            const winAmount = currentBet * 2;
            balance += winAmount + currentBet;
            endHand('BLACKJACK', `BLACKJACK! Won $${currentBet * 2}!`);
        }
    }
}

function hit() {
    if (gameState !== 'PLAYING') return;

    playerHand.push(drawCard());
    playSound('card');
    renderHands();
    updateRecommendation();

    document.getElementById('btnDouble').disabled = true;
    document.getElementById('btnSurrender').disabled = true;
    document.getElementById('btnDouble').style.opacity = '0.5';
    document.getElementById('btnSurrender').style.opacity = '0.5';

    const score = calculateScore(playerHand);
    if (score > 21) {
        dealerHand[1].hidden = false;
        renderHands();
        endHand('BUST', 'You Busted!');
    }
}

function stand() {
    if (gameState !== 'PLAYING') return;
    dealerPlay();
}

function doubleDown() {
    if (gameState !== 'PLAYING' || playerHand.length !== 2) return;
    if (balance < currentBet) {
        showMessage('Insufficient balance to double!', 'bg-amber-500 text-slate-950');
        return;
    }

    balance -= currentBet;
    currentBet *= 2;
    updateUI();

    playerHand.push(drawCard());
    playSound('card');
    renderHands();
    updateRecommendation();

    const score = calculateScore(playerHand);
    if (score > 21) {
        dealerHand[1].hidden = false;
        renderHands();
        endHand('BUST', 'Busted on Double Down!');
    } else {
        dealerPlay();
    }
}

function surrender() {
    if (gameState !== 'PLAYING' || playerHand.length !== 2) return;

    balance += currentBet / 2;
    dealerHand[1].hidden = false;
    renderHands();
    endHand('SURRENDER', 'Hand Surrendered (Half bet returned)');
}

// --- DEALER AI ---
function dealerPlay() {
    gameState = 'DEALER_TURN';
    dealerHand[1].hidden = false;
    renderHands();

    const dealerInterval = setInterval(() => {
        let score = calculateScore(dealerHand);

        if (score < 17 || isSoft17(dealerHand)) {
            dealerHand.push(drawCard());
            playSound('card');
            renderHands();
        } else {
            clearInterval(dealerInterval);
            evaluateWinner();
        }
    }, 600);
}

// --- WINNER EVALUATION ---
function evaluateWinner() {
    const pScore = calculateScore(playerHand);
    const dScore = calculateScore(dealerHand);

    if (dScore > 21) {
        balance += currentBet * 2;
        logResult('WIN');
        endHand('WIN', 'Dealer Busted! You Win!');
    } else if (pScore > dScore) {
        balance += currentBet * 2;
        logResult('WIN');
        endHand('WIN', `You Win $${currentBet}!`);
    } else if (dScore > pScore) {
        logResult('LOSE');
        endHand('LOSE', 'Dealer Wins!');
    } else {
        balance += currentBet;
        logResult('PUSH');
        endHand('PUSH', 'Push! Bet Returned.');
    }
}

function endHand(result, message) {
    gameState = 'RESOLVED';

    if (result === 'WIN' || result === 'BLACKJACK') {
        showMessage(message, 'bg-emerald-500 text-white');
        playSound('win');
    } else if (result === 'LOSE' || result === 'BUST') {
        showMessage(message, 'bg-rose-600 text-white');
        playSound('lose');
    } else {
        showMessage(message, 'bg-amber-500 text-slate-950');
    }

    currentBet = 0;
    updateUI();
    updateRecommendation();
}

// --- SIMULATE 100 GAMES ---
async function simulateGames() {
    if (gameState === 'PLAYING' || gameState === 'DEALER_TURN') {
        showMessage('Finish current hand first!', 'bg-amber-500 text-slate-950');
        return;
    }

    const originalBalance = balance;
    const originalWins = wins;
    const originalLosses = losses;
    const originalPushes = pushes;
    const betAmount = Math.min(50, balance);

    if (betAmount === 0) {
        showMessage('No balance to simulate!', 'bg-rose-600 text-white');
        return;
    }

    showMessage('Simulating 100 games...', 'bg-indigo-500 text-white');
    document.getElementById('btnSimulate').disabled = true;

    const controls = document.querySelectorAll('button');
    controls.forEach(btn => {
        if (btn.id !== 'soundToggleBtn') {
            btn.disabled = true;
        }
    });

    for (let i = 0; i < 100; i++) {
        playerHand = [];
        dealerHand = [];
        gameState = 'PLAYING';

        balance -= betAmount;
        currentBet = betAmount;

        playerHand.push(drawCard());
        dealerHand.push(drawCard());
        playerHand.push(drawCard());
        const hiddenCard = drawCard();
        hiddenCard.hidden = true;
        dealerHand.push(hiddenCard);

        const playerVal = calculateScore(playerHand);
        if (playerVal === 21) {
            dealerHand[1].hidden = false;
            const dealerVal = calculateScore(dealerHand);
            if (dealerVal === 21) {
                balance += currentBet;
                pushes++;
            } else {
                balance += currentBet * 2 + currentBet;
                wins++;
            }
            currentBet = 0;
            continue;
        }

        const dealerUpcard = dealerHand[0];
        const recommendation = getRecommendation(playerHand, dealerUpcard);

        if (recommendation.action === 'Double' && balance >= currentBet && playerHand.length === 2) {
            balance -= currentBet;
            currentBet *= 2;
            playerHand.push(drawCard());
        } else if (recommendation.action === 'Hit') {
            while (playerHand.length < 5) {
                const newRec = getRecommendation(playerHand, dealerUpcard);
                if (newRec.action !== 'Hit') break;
                playerHand.push(drawCard());
                if (calculateScore(playerHand) >  });
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
