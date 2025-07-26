// Configuration
const BACKEND_URL = 'https://0cfacbb8-a7f0-4ae2-ab94-f5afc8a632f1.preview.emergentagent.com';

// DOM Elements
const loginBtn = document.getElementById('loginBtn');
const userSection = document.getElementById('userSection');
const userEmail = document.getElementById('userEmail');
const logoutBtn = document.getElementById('logoutBtn');
const searchBtn = document.getElementById('searchBtn');
const loadingSection = document.getElementById('loadingSection');
const resultsSection = document.getElementById('resultsSection');
const noResultsSection = document.getElementById('noResultsSection');
const flightResults = document.getElementById('flightResults');
const premiumBanner = document.getElementById('premiumBanner');
const sortControls = document.getElementById('sortControls');
const upgradeBtn = document.getElementById('upgradeBtn');
const moreResultsBtn = document.getElementById('moreResultsBtn');

// State
let currentUser = null;
let isPremium = false;
let currentFlights = [];
let currentSearch = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    await loadUserState();
    await loadSearchFromUrl();
});

// Load user authentication state
async function loadUserState() {
    try {
        const stored = await chrome.storage.local.get(['userEmail', 'isPremium']);
        if (stored.userEmail) {
            currentUser = stored.userEmail;
            isPremium = stored.isPremium || false;
            updateUIForLoggedInUser();
        }
    } catch (error) {
        console.error('Error loading user state:', error);
    }
}

// Load search query from current tab if it's a flight search
async function loadSearchFromUrl() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab.url && tab.url.includes('google.com')) {
            // Try to extract flight search from URL or tab
            const urlParams = new URLSearchParams(new URL(tab.url).search);
            const query = urlParams.get('q') || '';
            
            if (query.toLowerCase().includes('flight')) {
                // Parse flight query like "flights Geneva Tokyo"
                const match = query.match(/flights?\s+([a-zA-Z\s]+)\s+([a-zA-Z\s]+)/i);
                if (match) {
                    document.getElementById('fromCity').value = match[1].trim();
                    document.getElementById('toCity').value = match[2].trim();
                    
                    // Set default date to tomorrow
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    document.getElementById('departDate').value = tomorrow.toISOString().split('T')[0];
                }
            }
        }
    } catch (error) {
        console.error('Error loading search from URL:', error);
    }
}

// Update UI for logged-in user
function updateUIForLoggedInUser() {
    loginBtn.classList.add('hidden');
    userSection.classList.remove('hidden');
    userEmail.textContent = currentUser;
    
    if (isPremium) {
        premiumBanner.classList.add('hidden');
        sortControls.classList.remove('hidden');
    }
}

// Mock login (replace with real Google auth later)
loginBtn.addEventListener('click', async () => {
    // For now, simulate login
    const mockEmail = 'user@example.com';
    currentUser = mockEmail;
    isPremium = false;
    
    await chrome.storage.local.set({ 
        userEmail: mockEmail, 
        isPremium: false 
    });
    
    updateUIForLoggedInUser();
});

// Logout
logoutBtn.addEventListener('click', async () => {
    currentUser = null;
    isPremium = false;
    await chrome.storage.local.clear();
    
    loginBtn.classList.remove('hidden');
    userSection.classList.add('hidden');
    premiumBanner.classList.remove('hidden');
    sortControls.classList.add('hidden');
});

// Search flights
searchBtn.addEventListener('click', async () => {
    const from = document.getElementById('fromCity').value.trim();
    const to = document.getElementById('toCity').value.trim();
    const date = document.getElementById('departDate').value;
    const passengers = document.getElementById('passengers').value;
    
    if (!from || !to || !date) {
        alert('Please fill in all flight search fields');
        return;
    }
    
    currentSearch = { from, to, date, passengers };
    await searchFlights();
});

// Search flights API call
async function searchFlights() {
    try {
        showLoading(true);
        
        const response = await fetch(`${BACKEND_URL}/api/flights/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: currentSearch.from,
                to: currentSearch.to,
                departureDate: currentSearch.date,
                passengers: parseInt(currentSearch.passengers),
                premium: isPremium
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to search flights');
        }
        
        const data = await response.json();
        currentFlights = data.flights || [];
        
        showLoading(false);
        displayResults();
        
    } catch (error) {
        console.error('Search error:', error);
        showLoading(false);
        alert('Error searching flights. Please try again.');
    }
}

// Show/hide loading
function showLoading(show) {
    loadingSection.classList.toggle('hidden', !show);
    resultsSection.classList.toggle('hidden', show);
    noResultsSection.classList.add('hidden');
}

// Display flight results
function displayResults() {
    if (currentFlights.length === 0) {
        resultsSection.classList.add('hidden');
        noResultsSection.classList.remove('hidden');
        return;
    }
    
    resultsSection.classList.remove('hidden');
    noResultsSection.classList.add('hidden');
    
    // Show limited results for free users
    const displayFlights = isPremium ? currentFlights : currentFlights.slice(0, 3);
    
    flightResults.innerHTML = '';
    displayFlights.forEach(flight => {
        const flightCard = createFlightCard(flight);
        flightResults.appendChild(flightCard);
    });
    
    // Show "more results" hint for free users
    if (!isPremium && currentFlights.length > 3) {
        const moreHint = document.createElement('div');
        moreHint.className = 'text-center text-sm text-gray-500 py-2';
        moreHint.textContent = `+${currentFlights.length - 3} more flights available with Premium`;
        flightResults.appendChild(moreHint);
    }
}

// Create flight card HTML
function createFlightCard(flight) {
    const card = document.createElement('div');
    card.className = 'flight-card bg-white p-3 rounded-lg border hover:shadow-md transition-all cursor-pointer';
    
    card.innerHTML = `
        <div class="flex justify-between items-start mb-2">
            <div class="flex items-center space-x-2">
                <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span class="text-xs font-bold text-blue-600">${flight.airline}</span>
                </div>
                <div>
                    <p class="font-semibold text-sm">${flight.airline} ${flight.flightNumber}</p>
                    <p class="text-xs text-gray-500">${flight.aircraft}</p>
                </div>
            </div>
            <div class="text-right">
                <p class="font-bold text-lg text-green-600">$${flight.price}</p>
                <p class="text-xs text-gray-500">${flight.class}</p>
            </div>
        </div>
        
        <div class="flex justify-between items-center text-sm">
            <div>
                <p class="font-semibold">${flight.departure.time}</p>
                <p class="text-gray-600">${flight.departure.airport}</p>
            </div>
            <div class="text-center">
                <p class="text-gray-500">${flight.duration}</p>
                <div class="w-12 h-px bg-gray-300 mx-auto my-1"></div>
                <p class="text-xs text-gray-400">${flight.stops === 0 ? 'Direct' : flight.stops + ' stop' + (flight.stops > 1 ? 's' : '')}</p>
            </div>
            <div class="text-right">
                <p class="font-semibold">${flight.arrival.time}</p>
                <p class="text-gray-600">${flight.arrival.airport}</p>
            </div>
        </div>
        
        ${flight.baggage ? `<div class="mt-2 text-xs text-gray-500">Baggage: ${flight.baggage}</div>` : ''}
    `;
    
    card.addEventListener('click', () => {
        // Open booking or more details
        chrome.tabs.create({ url: flight.bookingUrl || 'https://www.google.com/flights' });
    });
    
    return card;
}

// Upgrade to premium
upgradeBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('premium.html') });
});

// More results button
moreResultsBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('flysnipe.html') });
});

// Sort functionality (premium only)
document.getElementById('sortBy').addEventListener('change', (e) => {
    if (!isPremium) return;
    
    const sortBy = e.target.value;
    currentFlights.sort((a, b) => {
        switch (sortBy) {
            case 'price':
                return a.price - b.price;
            case 'duration':
                return a.durationMinutes - b.durationMinutes;
            case 'departure':
                return a.departure.time.localeCompare(b.departure.time);
            default:
                return 0;
        }
    });
    
    displayResults();
});