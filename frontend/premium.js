// Premium page JavaScript
const BACKEND_URL = 'https://0cfacbb8-a7f0-4ae2-ab94-f5afc8a632f1.preview.emergentagent.com';

// DOM Elements
const backBtn = document.getElementById('backBtn');
const upgradeBtn = document.getElementById('upgradeBtn');
const premiumUpgradeBtn = document.getElementById('premiumUpgradeBtn');
const finalUpgradeBtn = document.getElementById('finalUpgradeBtn');

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkPaymentReturn();
});

// Setup event listeners
function setupEventListeners() {
    // Back button
    backBtn.addEventListener('click', () => {
        window.close();
    });
    
    // All upgrade buttons
    [upgradeBtn, premiumUpgradeBtn, finalUpgradeBtn].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', initiateUpgrade);
        }
    });
}

// Initiate premium upgrade
async function initiateUpgrade() {
    try {
        // Get user email from storage
        const stored = await chrome.storage.local.get(['userEmail']);
        const userEmail = stored.userEmail || 'anonymous';
        
        // Create checkout session
        const response = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                package_id: 'monthly',
                email: userEmail
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to create checkout session');
        }
        
        const data = await response.json();
        
        // Store session ID for verification
        await chrome.storage.local.set({
            pendingPayment: {
                sessionId: data.session_id,
                timestamp: Date.now()
            }
        });
        
        // Redirect to Stripe Checkout
        window.location.href = data.url;
        
    } catch (error) {
        console.error('Upgrade error:', error);
        alert('Failed to start upgrade process. Please try again.');
    }
}

// Check if returning from payment
async function checkPaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    
    if (sessionId) {
        // User returned from Stripe, verify payment
        await verifyPayment(sessionId);
    }
}

// Verify payment status
async function verifyPayment(sessionId) {
    try {
        showPaymentStatus('Verifying payment...', 'pending');
        
        // Poll payment status
        const maxAttempts = 10;
        let attempts = 0;
        
        const pollStatus = async () => {
            attempts++;
            
            try {
                const response = await fetch(`${BACKEND_URL}/api/payments/checkout/status/${sessionId}`);
                
                if (!response.ok) {
                    throw new Error('Failed to check payment status');
                }
                
                const data = await response.json();
                
                if (data.payment_status === 'paid') {
                    showPaymentStatus('Payment successful! You are now a Premium member.', 'success');
                    
                    // Update local storage
                    await chrome.storage.local.set({
                        isPremium: true,
                        premiumActivated: Date.now()
                    });
                    
                    // Clean up pending payment
                    await chrome.storage.local.remove(['pendingPayment']);
                    
                    // Redirect to success page after delay
                    setTimeout(() => {
                        window.location.href = 'success.html?upgrade=success';
                    }, 2000);
                    
                } else if (data.status === 'expired') {
                    showPaymentStatus('Payment session expired. Please try again.', 'error');
                } else if (attempts >= maxAttempts) {
                    showPaymentStatus('Payment verification timed out. Please check your email for confirmation.', 'error');
                } else {
                    // Continue polling
                    setTimeout(pollStatus, 2000);
                }
                
            } catch (error) {
                if (attempts >= maxAttempts) {
                    showPaymentStatus('Error verifying payment. Please contact support if you were charged.', 'error');
                } else {
                    setTimeout(pollStatus, 2000);
                }
            }
        };
        
        pollStatus();
        
    } catch (error) {
        console.error('Payment verification error:', error);
        showPaymentStatus('Error verifying payment. Please contact support.', 'error');
    }
}

// Show payment status
function showPaymentStatus(message, type) {
    // Create or update status overlay
    let statusOverlay = document.getElementById('payment-status-overlay');
    
    if (!statusOverlay) {
        statusOverlay = document.createElement('div');
        statusOverlay.id = 'payment-status-overlay';
        statusOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        document.body.appendChild(statusOverlay);
    }
    
    const statusColor = {
        pending: 'blue',
        success: 'green',
        error: 'red'
    }[type] || 'gray';
    
    statusOverlay.innerHTML = `
        <div class="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
            <div class="mb-4">
                ${type === 'pending' ? 
                    '<div class="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>' :
                    type === 'success' ? 
                    '<div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto"><span class="text-2xl text-green-600">✓</span></div>' :
                    '<div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto"><span class="text-2xl text-red-600">✗</span></div>'
                }
            </div>
            <p class="text-lg font-semibold text-gray-900 mb-2">
                ${type === 'pending' ? 'Processing Payment' : type === 'success' ? 'Payment Successful!' : 'Payment Failed'}
            </p>
            <p class="text-gray-600">${message}</p>
            ${type !== 'pending' ? 
                '<button onclick="document.getElementById(\'payment-status-overlay\').remove()" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Close</button>' : 
                ''
            }
        </div>
    `;
}

// Handle page visibility change (for payment return detection)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        // Page became visible, check for payment return
        checkPaymentReturn();
    }
});