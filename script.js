// ==================== GAME STATE ====================
const gameState = {
    balance: 1000,
    wager: 0,
    deck: [],
    dealerHand: [],
    playerHand: [],
    playerHands: [],
    currentHandIndex: 0,
    gamePhase: 'betting', // betting, player-turn, dealer-turn, game-over
    dealerFaceDownCard: null,
    isSplit: false,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    winHistory: []
};

// ==================== DOM ELEMENTS ====================
const elements = {
    balance: document.getElementById('balance'),
    wagerAmount: document.getElementById('wager-amount'),
    dealerHand: document.getElementById('dealer-hand'),
    playerHand: document.getElementById('player-hand'),
    dealerSum: document.getElementById('dealer-sum'),
    playerSum: document.getElementById('player-sum'),
    hitBtn: document.getElementById('hit-btn'),
    standBtn: document.getElementById('stand-btn'),
    doubleBtn: document.getElementById('double-btn'),
    splitBtn: document.getElementById('split-btn'),
    dealBtn: document.getElementById('deal-btn'),
    clearWagerBtn: document.getElementById('clear-wager'),
    simulateBtn: document.getElementById('simulate-btn'),
    newGameBtn: document.getElementById('new-game-btn'),
    newGameSection: document.getElementById('new-game-section'),
    recommendation: document.getElementById('recommendation'),
    rationale: document.getElementById('rationale'),
    winRate: document.getElementById('win-rate'),
    gamesPlayed: document.getElementById('games-played'),
    resultMessage: document.getElementById('result-message'),
    resultText: document.getElementById('result-text'),
    resultAmount: document.getElementById('result-amount'),
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text')
};

// ==================== CARD DECK ====================
const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck() {
    const deck = [];
    for (const suit of suits) {
        for (const value of values) {
            const isRed = suit === 'hearts' || suit === 'diamonds';
            deck.push({ suit, value, isRed, id: `${value}-${suit}-${Math.random().toString(36).substr(2, 9)}` });
        }
    }
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function getCardValue(card) {
    if (['J', 'Q', 'K'].includes(card.value)) return 10;
    if (card.value === 'A') return 11;
    return parseInt(card.value);
}

function getHandValue(hand) {
    let value = 0;
    let aces = 0;
    for (const card of hand) {
        const cardValue = getCardValue(card);
        value += cardValue;
        if (card.value === 'A') aces++;
    }
    while (value > 21 && aces > 0) {
        value -= 10;
        aces--;
    }
    return value;
}

function isSoft17(hand) {
    const value = getHandValue(hand);
    if (value !== 17) return false;
    let acesAs11 = 0;
    for (const card of hand) {
        if (card.value === 'A') {
            const handWithoutAce = hand.filter(c => c !== card);
            const sumWithoutAce = getHandValue(handWithoutAce);
            if (sumWithoutAce + 11 <= 21) {
                acesAs11++;
            }
        }
    }
    return acesAs11 > 0;
}

function isBlackjack(hand) {
    return hand.length === 2 && getHandValue(hand) === 21;
}

function isBust(hand) {
    return getHandValue(hand) > 21;
}

// ==================== RENDERING ====================
function renderCard(card, isFaceDown = false) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';

    if (isFaceDown) {
        cardEl.classList.add('card-face-down');
        return cardEl;
    }

    const isRed = card.isRed;
    const suitSymbol = getSuitSymbol(card.suit);
    const colorClass = isRed ? 'card-red' : 'card-black';

    cardEl.innerHTML = `
        <span class="suit-icon ${colorClass} corner-top-left">${suitSymbol}</span>
        <span class="suit-icon ${colorClass} corner-top-right">${suitSymbol}</span>
        <span class="card-value ${colorClass} top-left">${card.value}</span>
        <span class="card-value ${colorClass} top-right">${card.value}</span>
        <span class="card-center ${colorClass}">${suitSymbol}</span>
        <span class="suit-icon ${colorClass} corner-bottom-left">${suitSymbol}</span>
        <span class="suit-icon ${colorClass} corner-bottom-right">${suitSymbol}</span>
        <span class="card-value ${colorClass} bottom-left">${card.value}</span>
        <span class="card-value ${colorClass} bottom-right">${card.value}</span>
    `;
    return cardEl;
}

function getSuitSymbol(suit) {
    switch (suit) {
        case 'hearts': return '♥';
        case 'diamonds': return '♦';
        case 'clubs': return '♣';
        case 'spades': return '♠';
        default: return '';
    }
}

function renderHand(hand, container, isDealer = false, showFaceDown = true) {
    container.innerHTML = '';

    for (let i = 0; i < hand.length; i++) {
        const card = hand[i];
        const isFaceDown = isDealer && i === 0 && showFaceDown;
        const cardEl = renderCard(card, isFaceDown);
        container.appendChild(cardEl);
    }
}

function updateDealerDisplay() {
    renderHand(gameState.dealerHand, elements.dealerHand, true, gameState.gamePhase !== 'game-over');

    if (gameState.gamePhase === 'game-over' || gameState.gamePhase === 'dealer-turn') {
        elements.dealerSum.textContent = `Sum: ${getHandValue(gameState.dealerHand)}`;
    } else {
        const visibleValue = gameState.dealerHand.length > 0 ? getCardValue(gameState.dealerHand[0]) : 0;
        elements.dealerSum.textContent = `Sum: ${visibleValue} + ?`;
    }
}

function updatePlayerSum() {
    const value = getHandValue(gameState.playerHand);
    elements.playerSum.textContent = `Sum: ${value}`;
}

function updateBalance() {
    elements.balance.textContent = `$${gameState.balance}`;
}

function updateWager() {
    elements.wagerAmount.textContent = `$${gameState.wager}`;
}

function updateStats() {
    const totalGames = gameState.gamesPlayed;
    if (totalGames === 0) {
        elements.winRate.textContent = '0.00%';
    } else {
        const winRate = ((gameState.wins + gameState.pushes * 0.5) / totalGames * 100).toFixed(2);
        elements.winRate.textContent = `${winRate}%`;
    }
    elements.gamesPlayed.textContent = totalGames;
}

function updateUIState() {
    elements.hitBtn.disabled = true;
    elements.standBtn.disabled = true;
    elements.doubleBtn.disabled = true;
    elements.splitBtn.disabled = true;
    elements.dealBtn.disabled = true;
    elements.clearWagerBtn.disabled = true;

    switch (gameState.gamePhase) {
        case 'betting':
            elements.dealBtn.disabled = gameState.wager === 0;
            elements.clearWagerBtn.disabled = gameState.wager === 0;
            break;

        case 'player-turn':
            elements.hitBtn.disabled = false;
            elements.standBtn.disabled = false;

            if (gameState.playerHand.length === 2 && gameState.balance >= gameState.wager) {
                elements.doubleBtn.disabled = false;
            }

            if (gameState.playerHand.length === 2 &&
                getCardValue(gameState.playerHand[0]) === getCardValue(gameState.playerHand[1]) &&
                gameState.balance >= gameState.wager) {
                elements.splitBtn.disabled = false;
            }
            break;

        case 'dealer-turn':
        case 'game-over':
            elements.dealBtn.disabled = false;
            break;
    }
}

// ==================== GAME LOGIC ====================
function startGame() {
    elements.newGameSection.style.display = 'none';
    gameState.deck = createDeck();
    gameState.dealerHand = [];
    gameState.playerHand = [];
    gameState.gamePhase = 'player-turn';
    gameState.isSplit = false;
    gameState.playerHands = [gameState.playerHand];
    gameState.currentHandIndex = 0;

    // Deal cards: dealer, player, dealer, player
    gameState.dealerHand.push(drawCard());
    gameState.playerHand.push(drawCard());
    gameState.dealerHand.push(drawCard());
    gameState.playerHand.push(drawCard());

    // Check for blackjack
    if (isBlackjack(gameState.playerHand)) {
        if (isBlackjack(gameState.dealerHand)) {
            endGame('push');
        } else {
            endGame('win', true);
        }
    } else {
        updateUIState();
        updateRecommendation();
    }

    renderHand(gameState.dealerHand, elements.dealerHand, true, true);
    renderHand(gameState.playerHand, elements.playerHand);
    updateDealerDisplay();
    updatePlayerSum();
}

function drawCard() {
    if (gameState.deck.length === 0) {
        gameState.deck = createDeck();
    }
    return gameState.deck.pop();
}

function playerHit() {
    if (gameState.gamePhase !== 'player-turn') return;

    gameState.playerHand.push(drawCard());
    renderHand(gameState.playerHand, elements.playerHand);
    updatePlayerSum();
    updateRecommendation();

    const value = getHandValue(gameState.playerHand);
    if (value >= 21) {
        if (value === 21) {
            playerStand();
        } else {
            endGame('lose');
        }
    }
}

function playerStand() {
    if (gameState.gamePhase !== 'player-turn') return;

    gameState.gamePhase = 'dealer-turn';
    updateUIState();

    updateDealerDisplay();

    setTimeout(dealerPlay, 500);
}

function dealerPlay() {
    if (gameState.gamePhase !== 'dealer-turn') return;

    const dealerValue = getHandValue(gameState.dealerHand);

    if (dealerValue >= 17) {
        determineWinner();
        return;
    }

    gameState.dealerHand.push(drawCard());
    updateDealerDisplay();

    setTimeout(dealerPlay, 500);
}

function playerDoubleDown() {
    if (gameState.gamePhase !== 'player-turn') return;
    if (gameState.balance < gameState.wager) return;

    gameState.balance -= gameState.wager;
    gameState.wager *= 2;
    updateBalance();
    updateWager();

    gameState.playerHand.push(drawCard());
    renderHand(gameState.playerHand, elements.playerHand);
    updatePlayerSum();

    playerStand();
}

function playerSplit() {
    if (gameState.gamePhase !== 'player-turn') return;
    if (gameState.playerHand.length !== 2) return;
    if (gameState.balance < gameState.wager) return;

    const firstCard = gameState.playerHand[0];
    const secondCard = gameState.playerHand[1];

    if (getCardValue(firstCard) !== getCardValue(secondCard)) return;

    gameState.isSplit = true;
    gameState.playerHands = [
        [firstCard],
        [secondCard]
    ];
    gameState.currentHandIndex = 0;

    gameState.balance -= gameState.wager;
    gameState.wager *= 2;
    updateBalance();
    updateWager();

    gameState.playerHands[0].push(drawCard());
    gameState.playerHands[1].push(drawCard());

    gameState.playerHand = gameState.playerHands[0];
    renderHand(gameState.playerHand, elements.playerHand);
    updatePlayerSum();
    updateRecommendation();
}

function determineWinner() {
    const playerValue = getHandValue(gameState.playerHand);
    const dealerValue = getHandValue(gameState.dealerHand);

    let result = 'lose';
    let isBlackjackWin = false;

    if (isBust(gameState.dealerHand)) {
        result = 'win';
    } else if (isBust(gameState.playerHand)) {
        result = 'lose';
    } else if (playerValue > dealerValue) {
        result = 'win';
    } else if (playerValue < dealerValue) {
        result = 'lose';
    } else {
        result = 'push';
    }

    endGame(result, isBlackjackWin);
}

function endGame(result, isBlackjack = false) {
    gameState.gamePhase = 'game-over';
    updateUIState();
    updateDealerDisplay();
    elements.newGameSection.style.display = 'flex';

    let winAmount = 0;
    let message = '';
    let resultClass = '';

    switch (result) {
        case 'win':
            winAmount = isBlackjack ? Math.floor(gameState.wager * 2.5) : gameState.wager * 2;
            message = 'You Win!';
            resultClass = 'result-win';
            gameState.wins++;
            gameState.winHistory.push('win');
            break;
        case 'lose':
            winAmount = 0;
            message = 'You Lose';
            resultClass = 'result-lose';
            gameState.losses++;
            gameState.winHistory.push('lose');
            break;
        case 'push':
            winAmount = gameState.wager;
            message = 'Push';
            resultClass = 'result-push';
            gameState.pushes++;
            gameState.winHistory.push('push');
            break;
    }

    gameState.balance += winAmount;
    updateBalance();

    gameState.gamesPlayed++;
    updateStats();

    elements.resultText.textContent = message;
    elements.resultText.className = resultClass;

    if (result === 'win' && isBlackjack) {
        elements.resultAmount.textContent = `+$${winAmount} (Blackjack!)`;
    } else if (result === 'win') {
        elements.resultAmount.textContent = `+$${winAmount}`;
    } else if (result === 'lose') {
        elements.resultAmount.textContent = `-$${gameState.wager}`;
    } else {
        elements.resultAmount.textContent = `+$${winAmount}`;
    }

    elements.resultMessage.classList.add('show');

    setTimeout(() => {
        elements.resultMessage.classList.remove('show');
    }, 2000);
}

function resetGame() {
    gameState.gamePhase = 'betting';
    gameState.wager = 0;
    gameState.playerHand = [];
    gameState.dealerHand = [];
    gameState.isSplit = false;
    gameState.playerHands = [];
    gameState.currentHandIndex = 0;

    elements.newGameSection.style.display = 'none';
    updateWager();
    updateUIState();
    renderHand([], elements.dealerHand);
    renderHand([], elements.playerHand);
    elements.dealerSum.textContent = 'Sum: ?';
    elements.playerSum.textContent = 'Sum: 0';
    elements.recommendation.textContent = '-';
    elements.rationale.textContent = 'Place your bet and click Deal';
}

// ==================== RECOMMENDATION ALGORITHM ====================
const rationales = {
    hit_soft: 'With a soft hand, hitting gives you flexibility - the ace can count as 1 if needed.',
    hit_hard_low: 'Your hand is too low. Hitting increases your chance of getting closer to 21.',
    hit_dealer_strong: 'Dealer has a strong upcard. You need to improve your hand.',
    hit_always_12_vs_2: 'Always hit 12 against dealer 2 or 3.',
    hit_12_vs_7_A: 'Hit 12 against dealer 7, 8, 9, 10, or A.',
    stand_strong: 'Your hand is strong. Standing prevents busting.',
    stand_dealer_weak: 'Dealer has a weak upcard (2-6). They are likely to bust.',
    stand_17_plus: 'Always stand on 17 or higher.',
    stand_soft_19_plus: 'Always stand on soft 19 or higher.',
    stand_13_16_vs_2_6: 'Stand on 13-16 when dealer shows 2-6.',
    double_hard_10: 'Double down on hard 10 against dealer 2-9.',
    double_hard_11: 'Double down on hard 11 against dealer 2-10 (but not A).',
    double_hard_9: 'Double down on hard 9 against dealer 3-6.',
    double_soft_13_18: 'Double down on soft 13-18 against dealer 5-6.',
    double_soft_15_18: 'Double down on soft 15-18 against dealer 4-6.',
    double_soft_17_18: 'Double down on soft 17-18 against dealer 3-6.',
    split_aces: 'Always split Aces.',
    split_eights: 'Always split 8s.',
    split_nines: 'Split 9s against dealer 2-9 (except 7).',
    split_sevens: 'Split 7s against dealer 2-7.',
    split_sixes: 'Split 6s against dealer 2-6.',
    split_twos_threes: 'Split 2s and 3s against dealer 2-7.',
    split_fours: 'Split 4s only against dealer 5-6.',
    split_fives: 'Never split 5s - treat as 10 and double if possible.',
    split_tens: 'Never split 10s - stand on 20.',
    no_split: 'Do not split this pair against this dealer card.'
};

function updateRecommendation() {
    if (gameState.gamePhase !== 'player-turn' || gameState.dealerHand.length === 0) {
        elements.recommendation.textContent = '-';
        elements.rationale.textContent = gameState.gamePhase === 'betting' ? 'Place your bet and click Deal' : '-';
        return;
    }

    const dealerUpcard = getCardValue(gameState.dealerHand[0]);
    const playerHand = gameState.playerHand;
    const playerValue = getHandValue(playerHand);
    const isPair = playerHand.length === 2 &&
                  getCardValue(playerHand[0]) === getCardValue(playerHand[1]);
    const pairValue = isPair ? getCardValue(playerHand[0]) : 0;
    const hasAce = playerHand.some(c => c.value === 'A');
    const aceCount = playerHand.filter(c => c.value === 'A').length;
    const minValue = playerValue - (aceCount * 10);
    const isSoft = hasAce && minValue + 10 === playerValue;

    const { action, rationaleKey } = getBasicStrategyRecommendation(
        playerValue, dealerUpcard, isSoft, isPair, pairValue, playerHand.length === 2
    );

    elements.recommendation.textContent = action;
    elements.rationale.textContent = rationales[rationaleKey] || rationales.hit_hard_low;
}

function getBasicStrategyRecommendation(playerValue, dealerUpcard, isSoft, isPair, pairValue, canDouble) {
    if (isPair) {
        return getSplitRecommendation(pairValue, dealerUpcard);
    }

    if (canDouble) {
        const doubleRec = getDoubleRecommendation(playerValue, dealerUpcard, isSoft);
        if (doubleRec.action === 'Double Down') {
            return doubleRec;
        }
    }

    return getHitStandRecommendation(playerValue, dealerUpcard, isSoft);
}

function getSplitRecommendation(pairValue, dealerUpcard) {
    if (pairValue === 11) return { action: 'Split', rationaleKey: 'split_aces' };
    if (pairValue === 8) return { action: 'Split', rationaleKey: 'split_eights' };

    if (pairValue === 10) return { action: 'Stand', rationaleKey: 'split_tens' };
    if (pairValue === 5) return { action: 'Double Down', rationaleKey: 'split_fives' };

    switch (pairValue) {
        case 9:
            if (dealerUpcard >= 2 && dealerUpcard <= 9 && dealerUpcard !== 7) {
                return { action: 'Split', rationaleKey: 'split_nines' };
            }
            return { action: 'Stand', rationaleKey: 'no_split' };
        case 7:
            if (dealerUpcard >= 2 && dealerUpcard <= 7) {
                return { action: 'Split', rationaleKey: 'split_sevens' };
            }
            return { action: 'Hit', rationaleKey: 'no_split' };
        case 6:
            if (dealerUpcard >= 2 && dealerUpcard <= 6) {
                return { action: 'Split', rationaleKey: 'split_sixes' };
            }
            return { action: 'Hit', rationaleKey: 'no_split' };
        case 4:
            if (dealerUpcard === 5 || dealerUpcard === 6) {
                return { action: 'Split', rationaleKey: 'split_fours' };
            }
            return { action: 'Hit', rationaleKey: 'no_split' };
        case 3:
        case 2:
            if (dealerUpcard >= 2 && dealerUpcard <= 7) {
                return { action: 'Split', rationaleKey: 'split_twos_threes' };
            }
            return { action: 'Hit', rationaleKey: 'no_split' };
    }

    return { action: 'Hit', rationaleKey: 'no_split' };
}

function getDoubleRecommendation(playerValue, dealerUpcard, isSoft) {
    if (!isSoft) {
        if (playerValue === 11 && dealerUpcard !== 11) {
            return { action: 'Double Down', rationaleKey: 'double_hard_11' };
        }
        if (playerValue === 10 && dealerUpcard >= 2 && dealerUpcard <= 9) {
            return { action: 'Double Down', rationaleKey: 'double_hard_10' };
        }
        if (playerValue === 9 && dealerUpcard >= 3 && dealerUpcard <= 6) {
            return { action: 'Double Down', rationaleKey: 'double_hard_9' };
        }
    }

    if (isSoft) {
        if (playerValue >= 13 && playerValue <= 18 && (dealerUpcard === 5 || dealerUpcard === 6)) {
            return { action: 'Double Down', rationaleKey: 'double_soft_13_18' };
        }
        if (playerValue >= 15 && playerValue <= 18 && (dealerUpcard === 4 || dealerUpcard === 5 || dealerUpcard === 6)) {
            return { action: 'Double Down', rationaleKey: 'double_soft_15_18' };
        }
        if ((playerValue === 17 || playerValue === 18) && dealerUpcard >= 3 && dealerUpcard <= 6) {
            return { action: 'Double Down', rationaleKey: 'double_soft_17_18' };
        }
    }

    return { action: '', rationaleKey: '' };
}

function getHitStandRecommendation(playerValue, dealerUpcard, isSoft) {
    if (playerValue >= 17) {
        return { action: 'Stand', rationaleKey: 'stand_17_plus' };
    }

    if (isSoft) {
        if (playerValue >= 19) {
            return { action: 'Stand', rationaleKey: 'stand_soft_19_plus' };
        }
        if (playerValue >= 13 && playerValue <= 18 && dealerUpcard >= 2 && dealerUpcard <= 6) {
            return { action: 'Double Down', rationaleKey: 'double_soft_13_18' };
        }
        if (playerValue >= 13 && playerValue <= 18 && dealerUpcard >= 7) {
            return { action: 'Stand', rationaleKey: 'stand_soft_19_plus' };
        }
        if (playerValue === 12) {
            if (dealerUpcard === 2 || dealerUpcard === 3) {
                return { action: 'Hit', rationaleKey: 'hit_always_12_vs_2' };
            }
            if (dealerUpcard >= 4 && dealerUpcard <= 6) {
                return { action: 'Double Down', rationaleKey: 'double_soft_13_18' };
            }
            if (dealerUpcard >= 7) {
                return { action: 'Hit', rationaleKey: 'hit_12_vs_7_A' };
            }
        }
    }

    if (playerValue <= 16) {
        if (playerValue >= 13 && dealerUpcard >= 2 && dealerUpcard <= 6) {
            return { action: 'Stand', rationaleKey: 'stand_13_16_vs_2_6' };
        }
        if (playerValue === 12 && (dealerUpcard === 2 || dealerUpcard === 3)) {
            return { action: 'Hit', rationaleKey: 'hit_always_12_vs_2' };
        }
        if (playerValue === 12 && dealerUpcard >= 7) {
            return { action: 'Hit', rationaleKey: 'hit_12_vs_7_A' };
        }
        if (dealerUpcard >= 7) {
            return { action: 'Hit', rationaleKey: 'hit_dealer_strong' };
        }
        return { action: 'Hit', rationaleKey: 'hit_hard_low' };
    }

    return { action: 'Stand', rationaleKey: 'stand_17_plus' };
}

// ==================== WAGERING ====================
function addToWager(amount) {
    if (gameState.gamePhase !== 'betting') return;
    if (gameState.balance < amount) return;

    gameState.wager += amount;
    gameState.balance -= amount;
    updateWager();
    updateBalance();
    updateUIState();
}

function clearWager() {
    if (gameState.gamePhase !== 'betting') return;

    gameState.balance += gameState.wager;
    gameState.wager = 0;
    updateWager();
    updateBalance();
    updateUIState();
}

// ==================== SIMULATION ====================
async function simulateGames(count = 100) {
    elements.loadingOverlay.classList.add('show');
    elements.simulateBtn.disabled = true;

    const originalBalance = gameState.balance;
    const originalWager = gameState.wager;
    const originalPhase = gameState.gamePhase;

    let currentGame = 0;

    for (let i = 0; i < count; i++) {
        currentGame = i + 1;
        elements.loadingText.textContent = `Simulating... ${currentGame}/${count}`;

        gameState.wager = Math.min(100, Math.floor(gameState.balance * 0.1)) || 10;
        if (gameState.wager > gameState.balance) {
            gameState.wager = gameState.balance;
        }

        gameState.balance -= gameState.wager;
        gameState.gamePhase = 'player-turn';
        gameState.dealerHand = [];
        gameState.playerHand = [];
        gameState.isSplit = false;

        gameState.deck = createDeck();

        gameState.dealerHand.push(drawCard());
        gameState.playerHand.push(drawCard());
        gameState.dealerHand.push(drawCard());
        gameState.playerHand.push(drawCard());

        if (isBlackjack(gameState.playerHand)) {
            if (isBlackjack(gameState.dealerHand)) {
                gameState.balance += gameState.wager;
                gameState.pushes++;
                gameState.gamesPlayed++;
            } else {
                gameState.balance += Math.floor(gameState.wager * 2.5);
                gameState.wins++;
                gameState.gamesPlayed++;
            }
            continue;
        }

        while (gameState.gamePhase === 'player-turn' && !isBust(gameState.playerHand)) {
            const dealerUpcard = getCardValue(gameState.dealerHand[0]);
            const playerValue = getHandValue(gameState.playerHand);
            const hasAce = gameState.playerHand.some(c => c.value === 'A');
            const aceCount = gameState.playerHand.filter(c => c.value === 'A').length;
            const minValue = playerValue - (aceCount * 10);
            const isSoft = hasAce && minValue + 10 === playerValue;
            const isPair = gameState.playerHand.length === 2 &&
                          getCardValue(gameState.playerHand[0]) === getCardValue(gameState.playerHand[1]);
            const pairValue = isPair ? getCardValue(gameState.playerHand[0]) : 0;

            const { action } = getBasicStrategyRecommendation(
                playerValue, dealerUpcard, isSoft, isPair, pairValue, gameState.playerHand.length === 2
            );

            if (action === 'Hit') {
                gameState.playerHand.push(drawCard());
            } else if (action === 'Stand') {
                gameState.gamePhase = 'dealer-turn';
                break;
            } else if (action === 'Double Down' && gameState.balance >= gameState.wager) {
                gameState.balance -= gameState.wager;
                gameState.wager *= 2;
                gameState.playerHand.push(drawCard());
                gameState.gamePhase = 'dealer-turn';
                break;
            } else if (action === 'Split' && gameState.playerHand.length === 2 &&
                       getCardValue(gameState.playerHand[0]) === getCardValue(gameState.playerHand[1]) &&
                       gameState.balance >= gameState.wager) {
                const firstCard = gameState.playerHand[0];
                gameState.balance -= gameState.wager;
                gameState.wager *= 2;
                gameState.playerHand = [firstCard, drawCard()];
                gameState.gamePhase = 'dealer-turn';
                break;
            } else {
                gameState.playerHand.push(drawCard());
            }
        }

        if (gameState.gamePhase === 'dealer-turn') {
            while (getHandValue(gameState.dealerHand) < 17 ||
                  (getHandValue(gameState.dealerHand) === 17 && isSoft17(gameState.dealerHand))) {
                gameState.dealerHand.push(drawCard());
            }
        }

        const playerValue = getHandValue(gameState.playerHand);
        const dealerValue = getHandValue(gameState.dealerHand);

        if (isBust(gameState.playerHand)) {
            gameState.losses++;
            gameState.gamesPlayed++;
        } else if (isBust(gameState.dealerHand)) {
            gameState.balance += gameState.wager * 2;
            gameState.wins++;
            gameState.gamesPlayed++;
        } else if (playerValue > dealerValue) {
            gameState.balance += gameState.wager * 2;
            gameState.wins++;
            gameState.gamesPlayed++;
        } else if (playerValue < dealerValue) {
            gameState.losses++;
            gameState.gamesPlayed++;
        } else {
            gameState.balance += gameState.wager;
            gameState.pushes++;
            gameState.gamesPlayed++;
        }

        await new Promise(resolve => setTimeout(resolve, 0));
    }

    gameState.wager = originalWager;
    gameState.gamePhase = originalPhase;

    updateBalance();
    updateWager();
    updateStats();
    updateUIState();
    renderHand([], elements.dealerHand);
    renderHand([], elements.playerHand);

    elements.loadingOverlay.classList.remove('show');
    elements.simulateBtn.disabled = false;

    const profit = gameState.balance - originalBalance;
    const winRate = ((gameState.wins + gameState.pushes * 0.5) / count * 100).toFixed(2);
    elements.resultText.textContent = `Simulation Complete`;
    elements.resultText.className = profit >= 0 ? 'result-win' : 'result-lose';
    elements.resultAmount.textContent = `+$${profit} | Win Rate: ${winRate}%`;
    elements.resultMessage.classList.add('show');

    setTimeout(() => {
        elements.resultMessage.classList.remove('show');
    }, 3000);
}

// ==================== EVENT LISTENERS ====================
function initEventListeners() {
    // Chip buttons for wagering
    const chipButtons = document.querySelectorAll('.wager-controls .chip');
    chipButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const value = parseInt(btn.dataset.value) || parseInt(btn.textContent);
            addToWager(value);
        });
    });

    // Action buttons
    elements.hitBtn.addEventListener('click', playerHit);
    elements.standBtn.addEventListener('click', playerStand);
    elements.doubleBtn.addEventListener('click', playerDoubleDown);
    elements.splitBtn.addEventListener('click', playerSplit);

    // Deal button - starts the game when wager is placed
    elements.dealBtn.addEventListener('click', () => {
        if (gameState.gamePhase === 'betting' && gameState.wager > 0) {
            startGame();
        } else if (gameState.gamePhase === 'game-over') {
            resetGame();
        }
    });

    // New Game button - resets table so a fresh game can be played
    elements.newGameBtn.addEventListener('click', resetGame);

    // Clear wager button
    elements.clearWagerBtn.addEventListener('click', clearWager);

    // Simulate button
    elements.simulateBtn.addEventListener('click', () => {
        simulateGames(100);
    });
}

// ==================== INITIALIZATION ====================
function init() {
    updateBalance();
    updateWager();
    updateUIState();
    updateStats();
    updateRecommendation();
    initEventListeners();
}

// Start the game when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
