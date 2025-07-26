// Success page JavaScript
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    verifyUpgrade();
    createConfetti();
});

// Setup event listeners
function setupEventListeners() {
    const startSearching = document.getElementById('startSearching');
    const closeWindow = document.getElementById('closeWindow');
    
    startSearching.addEventListener('click', () => {
        // Open extension popup or search page
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url.includes('google.com')) {
                // If on Google, close this window to use extension
                window.close();
            } else {
                // Open Google flights
                window.open('https://www.google.com/flights', '_blank');
                window.close();
            }
        });
    });
    
    closeWindow.addEventListener('click', () => {
        window.close();
    });
}

// Verify premium upgrade
async function verifyUpgrade() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');
        
        if (sessionId) {
            // Update local storage to reflect premium status
            await chrome.storage.local.set({
                isPremium: true,
                premiumActivated: Date.now(),
                lastUpgradeSessionId: sessionId
            });
            
            console.log('Premium status updated in storage');
        }
        
        // Also check URL for upgrade confirmation
        const upgrade = urlParams.get('upgrade');
        if (upgrade === 'success') {
            await chrome.storage.local.set({
                isPremium: true,
                premiumActivated: Date.now()
            });
        }
        
    } catch (error) {
        console.error('Error verifying upgrade:', error);
    }
}

// Create confetti animation
function createConfetti() {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3'];
    const confettiContainer = document.getElementById('confetti');
    
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            createConfettiPiece(confettiContainer, colors);
        }, i * 100);
    }
}

// Create individual confetti piece
function createConfettiPiece(container, colors) {
    const confetti = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    confetti.style.cssText = `
        position: absolute;
        width: 10px;
        height: 10px;
        background: ${color};
        top: -10px;
        left: ${Math.random() * 100}%;
        opacity: 1;
        animation: confettiFall ${2 + Math.random() * 3}s linear forwards;
        transform: rotate(${Math.random() * 360}deg);
        border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
    `;
    
    // Add CSS animation
    if (!document.getElementById('confetti-styles')) {
        const style = document.createElement('style');
        style.id = 'confetti-styles';
        style.textContent = `
            @keyframes confettiFall {
                0% {
                    transform: translateY(-10px) rotate(0deg);
                    opacity: 1;
                }
                100% {
                    transform: translateY(100vh) rotate(360deg);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    container.appendChild(confetti);
    
    // Remove confetti after animation
    setTimeout(() => {
        if (confetti.parentNode) {
            confetti.parentNode.removeChild(confetti);
        }
    }, 5000);
}

// Auto-close after 30 seconds if user doesn't interact
setTimeout(() => {
    if (document.visibilityState === 'visible') {
        const autoClose = confirm('Would you like to close this window and start using FlySnipe Premium?');
        if (autoClose) {
            window.close();
        }
    }
}, 30000);