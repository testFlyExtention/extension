// FlySnipe full results page JavaScript
const BACKEND_URL = 'https://0cfacbb8-a7f0-4ae2-ab94-f5afc8a632f1.preview.emergentagent.com';

// DOM Elements
const searchSummary = document.getElementById('searchSummary');
const searchDetails = document.getElementById('searchDetails');
const resultCount = document.getElementById('resultCount');
const loadingSection = document.getElementById('loadingSection');
const resultsSection = document.getElementById('resultsSection');
const noResultsSection = document.getElementById('noResultsSection');
const flightGrid = document.getElementById('flightGrid');
const sortSelect = document.getElementById('sortSelect');
const priceRange = document.getElementById('priceRange');
const priceValue = document.getElementById('priceValue');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const backToSearch = document.getElementById('backToSearch');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const userInfo = document.getElementById('userInfo');

// State
let allFlights = [];
let filteredFlights = [];
let displayedFlights = [];
let currentFilters = {
    class: 'all',
    stops: 'all',
    maxPrice: 3000
};
let resultsPerPage = 10;
let currentPage = 1;

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    await loadUserInfo();
    await loadSearchResults();
    setupEventListeners();
});

// Load user information
async function loadUserInfo() {
    try {
        const stored = await chrome.storage.local.get(['userEmail', 'isPremium']);
        if (stored.userEmail) {
            userInfo.textContent = `Welcome, ${stored.userEmail}`;
            if (stored.isPremium) {
                userInfo.innerHTML += ' <span class="text-green-600 font-semibold">Premium</span>';
            }
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

// Load search results
async function loadSearchResults() {
    try {
        showLoading(true);
        
        // Try to get search params from URL or storage
        const urlParams = new URLSearchParams(window.location.search);
        let searchParams = {
            from: urlParams.get('from') || 'Geneva',
            to: urlParams.get('to') || 'Tokyo',
            date: urlParams.get('date') || new Date(Date.now() + 86400000).toISOString().split('T')[0],
            passengers: parseInt(urlParams.get('passengers')) || 1
        };
        
        // If no URL params, try storage
        if (!urlParams.get('from')) {
            const stored = await chrome.storage.local.get(['lastSearch']);
            if (stored.lastSearch) {
                searchParams = stored.lastSearch;
            }
        }
        
        // Update search details display
        searchDetails.textContent = `${searchParams.from} → ${searchParams.to} • ${searchParams.date} • ${searchParams.passengers} passenger${searchParams.passengers > 1 ? 's' : ''}`;
        
        // Fetch flights
        const response = await fetch(`${BACKEND_URL}/api/flights/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: searchParams.from,
                to: searchParams.to,
                departureDate: searchParams.date,
                passengers: searchParams.passengers,
                premium: true // Always show all results on full page
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch flights');
        }
        
        const data = await response.json();
        allFlights = data.flights || [];
        
        showLoading(false);
        applyFiltersAndSort();
        
    } catch (error) {
        console.error('Error loading search results:', error);
        showLoading(false);
        showNoResults();
    }
}

// Show/hide loading
function showLoading(show) {
    loadingSection.classList.toggle('hidden', !show);
    resultsSection.classList.toggle('hidden', show);
    noResultsSection.classList.add('hidden');
}

// Apply filters and sorting
function applyFiltersAndSort() {
    // Start with all flights
    filteredFlights = [...allFlights];
    
    // Apply class filter
    if (currentFilters.class !== 'all') {
        filteredFlights = filteredFlights.filter(flight => 
            flight.class === currentFilters.class
        );
    }
    
    // Apply stops filter
    if (currentFilters.stops !== 'all') {
        if (currentFilters.stops === '2+') {
            filteredFlights = filteredFlights.filter(flight => flight.stops >= 2);
        } else {
            filteredFlights = filteredFlights.filter(flight => 
                flight.stops === parseInt(currentFilters.stops)
            );
        }
    }
    
    // Apply price filter
    filteredFlights = filteredFlights.filter(flight => 
        flight.price <= currentFilters.maxPrice
    );
    
    // Apply sorting
    const sortBy = sortSelect.value;
    filteredFlights.sort((a, b) => {
        switch (sortBy) {
            case 'price':
                return a.price - b.price;
            case 'price-desc':
                return b.price - a.price;
            case 'duration':
                return a.duration_minutes - b.duration_minutes;
            case 'departure':
                return a.departure.time.localeCompare(b.departure.time);
            case 'arrival':
                return a.arrival.time.localeCompare(b.arrival.time);
            default:
                return 0;
        }
    });
    
    // Reset pagination
    currentPage = 1;
    displayResults();
}

// Display results
function displayResults() {
    if (filteredFlights.length === 0) {
        showNoResults();
        return;
    }
    
    resultsSection.classList.remove('hidden');
    noResultsSection.classList.add('hidden');
    
    // Update result count
    resultCount.textContent = filteredFlights.length;
    
    // Calculate displayed flights
    const startIndex = 0;
    const endIndex = currentPage * resultsPerPage;
    displayedFlights = filteredFlights.slice(startIndex, endIndex);
    
    // Clear and populate flight grid
    flightGrid.innerHTML = '';
    displayedFlights.forEach(flight => {
        const flightCard = createFlightCard(flight);
        flightGrid.appendChild(flightCard);
    });
    
    // Update load more button
    loadMoreBtn.disabled = endIndex >= filteredFlights.length;
    loadMoreBtn.textContent = endIndex >= filteredFlights.length ? 
        'All results loaded' : 
        `Load More (${Math.min(resultsPerPage, filteredFlights.length - endIndex)} more)`;
}

// Create flight card
function createFlightCard(flight) {
    const card = document.createElement('div');
    card.className = 'flight-card bg-white rounded-xl shadow-sm border p-6 hover:shadow-lg transition-all cursor-pointer';
    
    card.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <div class="flex items-center space-x-4">
                <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span class="text-sm font-bold text-blue-600">${flight.airline}</span>
                </div>
                <div>
                    <h3 class="font-semibold text-lg">${flight.airline} ${flight.flightNumber}</h3>
                    <p class="text-gray-600">${flight.aircraft}</p>
                </div>
            </div>
            <div class="text-right">
                <p class="text-3xl font-bold text-green-600">$${flight.price}</p>
                <p class="text-gray-600">${flight.class}</p>
            </div>
        </div>
        
        <div class="flex justify-between items-center mb-4">
            <div class="text-center">
                <p class="text-2xl font-bold">${flight.departure.time}</p>
                <p class="text-gray-600">${flight.departure.airport}</p>
                <p class="text-sm text-gray-500">${flight.departure.city}</p>
            </div>
            
            <div class="flex-1 px-6">
                <div class="text-center mb-2">
                    <p class="text-gray-600">${flight.duration}</p>
                </div>
                <div class="relative">
                    <div class="h-px bg-gray-300 w-full"></div>
                    <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-2">
                        <span class="text-xs text-gray-500">
                            ${flight.stops === 0 ? 'Direct' : flight.stops + ' stop' + (flight.stops > 1 ? 's' : '')}
                        </span>
                    </div>
                </div>
            </div>
            
            <div class="text-center">
                <p class="text-2xl font-bold">${flight.arrival.time}</p>
                <p class="text-gray-600">${flight.arrival.airport}</p>
                <p class="text-sm text-gray-500">${flight.arrival.city}</p>
            </div>
        </div>
        
        <div class="flex justify-between items-center pt-4 border-t">
            <div class="text-sm text-gray-600">
                ${flight.baggage || 'Baggage policy varies'}
            </div>
            <button class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold">
                Select Flight
            </button>
        </div>
    `;
    
    // Add click handler
    card.addEventListener('click', (e) => {
        if (!e.target.classList.contains('bg-blue-600')) {
            window.open(flight.booking_url || 'https://www.google.com/flights', '_blank');
        }
    });
    
    // Add select button handler
    const selectBtn = card.querySelector('button');
    selectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.open(flight.booking_url || 'https://www.google.com/flights', '_blank');
    });
    
    return card;
}

// Show no results
function showNoResults() {
    resultsSection.classList.add('hidden');
    noResultsSection.classList.remove('hidden');
    resultCount.textContent = '0';
}

// Setup event listeners
function setupEventListeners() {
    // Sort change
    sortSelect.addEventListener('change', applyFiltersAndSort);
    
    // Price range
    priceRange.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        currentFilters.maxPrice = value;
        priceValue.textContent = `$${value}`;
        applyFiltersAndSort();
    });
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filterType = e.target.dataset.filter;
            const filterValue = e.target.dataset.value;
            
            // Update filter state
            currentFilters[filterType] = filterValue;
            
            // Update button styles
            document.querySelectorAll(`[data-filter="${filterType}"]`).forEach(b => {
                b.classList.remove('filter-active');
            });
            e.target.classList.add('filter-active');
            
            applyFiltersAndSort();
        });
    });
    
    // Load more
    loadMoreBtn.addEventListener('click', () => {
        currentPage++;
        displayResults();
    });
    
    // Clear filters
    clearFiltersBtn.addEventListener('click', () => {
        currentFilters = { class: 'all', stops: 'all', maxPrice: 3000 };
        priceRange.value = 3000;
        priceValue.textContent = '$3000';
        sortSelect.value = 'price';
        
        // Reset filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('filter-active');
            if (btn.dataset.value === 'all') {
                btn.classList.add('filter-active');
            }
        });
        
        applyFiltersAndSort();
    });
    
    // Back to search
    backToSearch.addEventListener('click', () => {
        window.close();
    });
}

// Initialize filter buttons
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.filter-btn[data-value="all"]').forEach(btn => {
        btn.classList.add('filter-active');
    });
});