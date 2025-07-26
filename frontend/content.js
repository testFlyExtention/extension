// Content script to detect flight searches on Google
console.log('FlySnipe content script loaded');

// Flight search detection patterns
const FLIGHT_PATTERNS = [
    /flights?\s+from\s+([a-zA-Z\s]+)\s+to\s+([a-zA-Z\s]+)/i,
    /flights?\s+([a-zA-Z\s]+)\s+to\s+([a-zA-Z\s]+)/i,
    /flights?\s+([a-zA-Z\s]+)\s+([a-zA-Z\s]+)/i,
    /(\w+)\s+to\s+(\w+)\s+flights?/i,
    /plane\s+tickets?\s+([a-zA-Z\s]+)\s+to\s+([a-zA-Z\s]+)/i,
    /airfare\s+([a-zA-Z\s]+)\s+to\s+([a-zA-Z\s]+)/i
];

let flySnipeIcon = null;
let isFlightSearch = false;

// Monitor search queries
function detectFlightSearch() {
    // Check URL for flight-related searches
    const url = window.location.href;
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q') || '';
    
    console.log('Checking query:', query);
    
    // Test if query matches flight patterns
    for (const pattern of FLIGHT_PATTERNS) {
        if (pattern.test(query)) {
            console.log('Flight search detected:', query);
            isFlightSearch = true;
            showFlySnipeIcon();
            return;
        }
    }
    
    // Also check for Google Flights URLs
    if (url.includes('google.com/flights') || url.includes('google.com/travel/flights')) {
        console.log('Google Flights page detected');
        isFlightSearch = true;
        showFlySnipeIcon();
        return;
    }
    
    // Hide icon if not a flight search
    if (flySnipeIcon && !isFlightSearch) {
        hideFlySnipeIcon();
    }
}

// Create and show FlySnipe icon
function showFlySnipeIcon() {
    if (flySnipeIcon) {
        flySnipeIcon.style.display = 'block';
        return;
    }
    
    // Create floating icon
    flySnipeIcon = document.createElement('div');
    flySnipeIcon.id = 'flysnipe-icon';
    flySnipeIcon.innerHTML = `
        <div style="
            position: fixed;
            top: 50%;
            right: 20px;
            z-index: 10000;
            background: linear-gradient(45deg, #3B82F6, #8B5CF6);
            color: white;
            padding: 12px 16px;
            border-radius: 50px;
            box-shadow: 0 4px 20px rgba(59, 130, 246, 0.3);
            cursor: pointer;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
            animation: flysnipe-pulse 2s infinite;
            user-select: none;
        " title="Search flights with FlySnipe">
            <span style="font-size: 18px;">✈️</span>
            <span>FlySnipe</span>
        </div>
    `;
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes flysnipe-pulse {
            0%, 100% { transform: translateY(-50%) scale(1); }
            50% { transform: translateY(-50%) scale(1.05); }
        }
        #flysnipe-icon:hover > div {
            transform: translateY(-50%) scale(1.1) !important;
            box-shadow: 0 6px 25px rgba(59, 130, 246, 0.4) !important;
        }
    `;
    document.head.appendChild(style);
    
    // Add click handler
    flySnipeIcon.addEventListener('click', () => {
        chrome.runtime.sendMessage({
            action: 'openPopup',
            searchQuery: new URLSearchParams(window.location.search).get('q') || ''
        });
    });
    
    document.body.appendChild(flySnipeIcon);
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        if (flySnipeIcon) {
            flySnipeIcon.style.opacity = '0.7';
        }
    }, 10000);
}

// Hide FlySnipe icon
function hideFlySnipeIcon() {
    if (flySnipeIcon) {
        flySnipeIcon.style.display = 'none';
    }
    isFlightSearch = false;
}

// Listen for URL changes (for SPAs like Google)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        setTimeout(detectFlightSearch, 1000); // Wait for page to load
    }
}).observe(document, { subtree: true, childList: true });

// Listen for search input changes
function monitorSearchInput() {
    const searchInput = document.querySelector('input[name="q"], textarea[name="q"], input[type="search"]');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value;
            if (query) {
                setTimeout(() => {
                    const urlParams = new URLSearchParams(window.location.search);
                    const currentQuery = urlParams.get('q') || '';
                    if (currentQuery) {
                        detectFlightSearch();
                    }
                }, 500);
            }
        });
    }
}

// Initial detection
setTimeout(() => {
    detectFlightSearch();
    monitorSearchInput();
}, 1000);

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkFlightSearch') {
        sendResponse({ isFlightSearch: isFlightSearch });
    }
});