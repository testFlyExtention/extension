// Background service worker for FlySnipe Chrome extension

console.log('FlySnipe background script loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
    console.log('FlySnipe extension installed/updated:', details.reason);
    
    if (details.reason === 'install') {
        // Set default settings
        chrome.storage.local.set({
            enabled: true,
            autoDetect: true,
            showNotifications: true
        });
        
        // Open welcome page (optional)
        // chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
    }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);
    
    switch (request.action) {
        case 'openPopup':
            // Store search query for popup to access
            chrome.storage.local.set({
                lastSearchQuery: request.searchQuery,
                lastSearchTime: Date.now()
            });
            
            // Open popup (this will happen automatically when user clicks extension icon)
            chrome.action.openPopup();
            sendResponse({ success: true });
            break;
            
        case 'checkFlightDetection':
            // Check if current tab has flight search
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'checkFlightSearch' }, (response) => {
                        sendResponse(response || { isFlightSearch: false });
                    });
                } else {
                    sendResponse({ isFlightSearch: false });
                }
            });
            return true; // Keep message channel open for async response
            
        case 'updateBadge':
            // Update extension badge
            const badgeText = request.flightCount > 0 ? request.flightCount.toString() : '';
            chrome.action.setBadgeText({ text: badgeText });
            chrome.action.setBadgeBackgroundColor({ color: '#3B82F6' });
            sendResponse({ success: true });
            break;
            
        case 'openFullResults':
            // Open full results page
            chrome.tabs.create({ 
                url: chrome.runtime.getURL('flysnipe.html'),
                active: true
            });
            sendResponse({ success: true });
            break;
            
        case 'openPremiumPage':
            // Open premium upgrade page
            chrome.tabs.create({ 
                url: chrome.runtime.getURL('premium.html'),
                active: true
            });
            sendResponse({ success: true });
            break;
    }
});

// Handle tab updates to detect flight searches
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        // Check if it's a Google search with flight keywords
        if (tab.url.includes('google.com/search') || tab.url.includes('google.com/flights')) {
            const url = new URL(tab.url);
            const query = url.searchParams.get('q') || '';
            
            if (query && (
                query.toLowerCase().includes('flight') || 
                query.toLowerCase().includes('plane') ||
                query.toLowerCase().includes('airfare') ||
                url.pathname.includes('flights')
            )) {
                // Store that this tab has a flight search
                chrome.storage.local.set({
                    [`tab_${tabId}_flightSearch`]: {
                        query: query,
                        url: tab.url,
                        timestamp: Date.now()
                    }
                });
                
                // Update badge to show flight search detected
                chrome.action.setBadgeText({ text: '✈', tabId: tabId });
                chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
            }
        }
    }
});

// Clean up storage when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.local.remove(`tab_${tabId}_flightSearch`);
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    console.log('Extension icon clicked on tab:', tab.url);
    
    // The popup will open automatically, but we can store context
    chrome.storage.local.set({
        lastClickedTab: {
            id: tab.id,
            url: tab.url,
            title: tab.title,
            timestamp: Date.now()
        }
    });
});

// Periodic cleanup of old storage data
setInterval(() => {
    chrome.storage.local.get(null, (items) => {
        const now = Date.now();
        const toRemove = [];
        
        for (const [key, value] of Object.entries(items)) {
            // Remove old tab data (older than 1 hour)
            if (key.startsWith('tab_') && value.timestamp && (now - value.timestamp) > 3600000) {
                toRemove.push(key);
            }
            
            // Remove old search queries (older than 24 hours)
            if (key === 'lastSearchQuery' && value.lastSearchTime && (now - value.lastSearchTime) > 86400000) {
                toRemove.push(key);
            }
        }
        
        if (toRemove.length > 0) {
            chrome.storage.local.remove(toRemove);
            console.log('Cleaned up old storage data:', toRemove);
        }
    });
}, 300000); // Run every 5 minutes