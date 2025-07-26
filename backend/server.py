from fastapi import FastAPI, APIRouter, HTTPException, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timedelta
import random
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="FlySnipe API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Initialize Stripe checkout
stripe_api_key = os.environ.get('STRIPE_API_KEY')
if stripe_api_key:
    stripe_checkout = None  # Will be initialized when needed

# Payment packages
PREMIUM_PACKAGES = {
    "monthly": {"price": 9.99, "currency": "usd", "description": "Monthly Premium Subscription"},
    "yearly": {"price": 99.99, "currency": "usd", "description": "Yearly Premium Subscription (Save 20%)"}
}

# Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class FlightSearchRequest(BaseModel):
    from_city: str = Field(..., alias="from")
    to_city: str = Field(..., alias="to")
    departure_date: str = Field(..., alias="departureDate")
    passengers: int = 1
    premium: bool = False

class Airport(BaseModel):
    code: str
    name: str
    time: str

class Flight(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    airline: str
    flight_number: str
    aircraft: str
    departure: dict
    arrival: dict
    duration: str
    duration_minutes: int
    price: int
    currency: str = "USD"
    class_type: str = Field(..., alias="class")
    stops: int
    baggage: Optional[str] = None
    booking_url: Optional[str] = None

class FlightSearchResponse(BaseModel):
    flights: List[Flight]
    total_results: int
    search_params: dict
    premium_features_used: bool = False

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: Optional[str] = None
    is_premium: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PremiumUpgrade(BaseModel):
    email: str
    stripe_session_id: Optional[str] = None

class PaymentTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    package_id: str
    amount: float
    currency: str
    session_id: str
    payment_status: str = "pending"
    metadata: Optional[Dict] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CheckoutRequest(BaseModel):
    package_id: str
    email: Optional[str] = None

# Mock flight data generator
def generate_mock_flights(from_city: str, to_city: str, departure_date: str, premium: bool = False) -> List[Flight]:
    airlines = [
        {"code": "AA", "name": "American Airlines"},
        {"code": "DL", "name": "Delta Airlines"},
        {"code": "UA", "name": "United Airlines"},
        {"code": "LH", "name": "Lufthansa"},
        {"code": "BA", "name": "British Airways"},
        {"code": "AF", "name": "Air France"},
        {"code": "KL", "name": "KLM"},
        {"code": "LX", "name": "Swiss International"},
    ]
    
    aircraft_types = ["Boeing 777", "Airbus A350", "Boeing 787", "Airbus A380", "Boeing 737", "Airbus A320"]
    class_types = ["Economy", "Premium Economy", "Business", "First Class"]
    
    # Generate airport codes based on cities
    from_code = from_city[:3].upper()
    to_code = to_city[:3].upper()
    
    flights = []
    num_flights = random.randint(8, 15) if premium else 3
    
    for i in range(num_flights):
        airline = random.choice(airlines)
        base_price = random.randint(300, 2000)
        departure_hour = random.randint(6, 22)
        duration_minutes = random.randint(120, 720)  # 2-12 hours
        
        arrival_time = datetime.strptime(departure_date, "%Y-%m-%d").replace(
            hour=departure_hour, minute=random.randint(0, 59)
        ) + timedelta(minutes=duration_minutes)
        
        flight = Flight(
            airline=airline["code"],
            flight_number=f"{airline['code']}{random.randint(100, 9999)}",
            aircraft=random.choice(aircraft_types),
            departure={
                "airport": f"{from_code}",
                "city": from_city,
                "time": f"{departure_hour:02d}:{random.randint(0, 59):02d}"
            },
            arrival={
                "airport": f"{to_code}",
                "city": to_city,
                "time": f"{arrival_time.hour:02d}:{arrival_time.minute:02d}"
            },
            duration=f"{duration_minutes // 60}h {duration_minutes % 60}m",
            duration_minutes=duration_minutes,
            price=base_price,
            **{"class": random.choice(class_types)},
            stops=random.choice([0, 0, 0, 1, 1, 2]),  # Mostly direct flights
            baggage="1 checked bag included" if random.choice([True, False]) else None,
            booking_url=f"https://www.example-airline.com/book/{uuid.uuid4()}"
        )
        flights.append(flight)
    
    # Sort by price by default
    flights.sort(key=lambda x: x.price)
    return flights

# API Routes
@api_router.get("/")
async def root():
    return {"message": "FlySnipe API is running", "status": "OK"}

@api_router.post("/flights/search", response_model=FlightSearchResponse)
async def search_flights(request: FlightSearchRequest):
    """Search for flights between two cities"""
    try:
        # Generate mock flight data
        flights = generate_mock_flights(
            request.from_city, 
            request.to_city, 
            request.departure_date,
            request.premium
        )
        
        # Store search in database for analytics
        search_record = {
            "id": str(uuid.uuid4()),
            "from_city": request.from_city,
            "to_city": request.to_city,
            "departure_date": request.departure_date,
            "passengers": request.passengers,
            "premium": request.premium,
            "results_count": len(flights),
            "timestamp": datetime.utcnow()
        }
        await db.flight_searches.insert_one(search_record)
        
        return FlightSearchResponse(
            flights=flights,
            total_results=len(flights),
            search_params={
                "from": request.from_city,
                "to": request.to_city,
                "date": request.departure_date,
                "passengers": request.passengers
            },
            premium_features_used=request.premium
        )
        
    except Exception as e:
        logging.error(f"Flight search error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to search flights")

@api_router.post("/auth/google")
async def google_auth(request: Request):
    """Handle Google authentication (mock for now)"""
    body = await request.json()
    token = body.get("id_token")
    
    if not token:
        raise HTTPException(status_code=400, detail="Missing id_token")
    
    # Mock verification - replace with real Google token verification
    mock_email = "user@example.com"
    
    # Check if user exists, create if not
    user = await db.users.find_one({"email": mock_email})
    if not user:
        new_user = User(email=mock_email, name="Mock User")
        await db.users.insert_one(new_user.dict())
        user = new_user.dict()
    
    return {"email": mock_email, "name": user.get("name", "User")}

@api_router.get("/check-premium")
async def check_premium(email: str):
    """Check if user has premium subscription"""
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"email": email, "is_premium": user.get("is_premium", False)}

@api_router.post("/create-checkout-session")
async def create_checkout_session(request: CheckoutRequest, http_request: Request):
    """Create Stripe checkout session for premium upgrade"""
    try:
        global stripe_checkout
        
        if not stripe_api_key:
            raise HTTPException(status_code=500, detail="Stripe not configured")
        
        # Initialize Stripe checkout if not already done
        if not stripe_checkout:
            host_url = str(http_request.base_url)
            webhook_url = f"{host_url}api/webhook/stripe"
            stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
        
        # Validate package
        if request.package_id not in PREMIUM_PACKAGES:
            raise HTTPException(status_code=400, detail="Invalid package ID")
        
        package = PREMIUM_PACKAGES[request.package_id]
        
        # Build URLs from request origin
        origin_url = str(http_request.base_url).rstrip('/')
        success_url = f"{origin_url}/success.html?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{origin_url}/premium.html"
        
        # Create checkout session
        checkout_request = CheckoutSessionRequest(
            amount=package["price"],
            currency=package["currency"],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "package_id": request.package_id,
                "email": request.email or "anonymous",
                "description": package["description"]
            }
        )
        
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Store payment transaction
        transaction = PaymentTransaction(
            email=request.email or "anonymous",
            package_id=request.package_id,
            amount=package["price"],
            currency=package["currency"],
            session_id=session.session_id,
            payment_status="pending",
            metadata=checkout_request.metadata
        )
        
        await db.payment_transactions.insert_one(transaction.dict())
        
        return {"url": session.url, "session_id": session.session_id}
        
    except Exception as e:
        logging.error(f"Checkout session creation error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create checkout session")

@api_router.get("/payments/checkout/status/{session_id}")
async def get_checkout_status(session_id: str):
    """Get checkout session status"""
    try:
        if not stripe_checkout:
            raise HTTPException(status_code=500, detail="Stripe not configured")
        
        # Get status from Stripe
        checkout_status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        
        # Update local transaction
        transaction = await db.payment_transactions.find_one({"session_id": session_id})
        if transaction and transaction["payment_status"] != "completed":
            if checkout_status.payment_status == "paid":
                # Update transaction
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {
                        "$set": {
                            "payment_status": "completed",
                            "updated_at": datetime.utcnow()
                        }
                    }
                )
                
                # Upgrade user to premium if email provided
                if transaction["email"] != "anonymous":
                    await db.users.update_one(
                        {"email": transaction["email"]},
                        {
                            "$set": {
                                "is_premium": True,
                                "premium_activated_at": datetime.utcnow(),
                                "subscription_type": transaction["package_id"]
                            }
                        },
                        upsert=True
                    )
        
        return {
            "status": checkout_status.status,
            "payment_status": checkout_status.payment_status,
            "amount_total": checkout_status.amount_total,
            "currency": checkout_status.currency,
            "session_id": session_id
        }
        
    except Exception as e:
        logging.error(f"Checkout status error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get checkout status")

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    try:
        if not stripe_checkout:
            raise HTTPException(status_code=500, detail="Stripe not configured")
        
        # Get raw body and signature
        body = await request.body()
        signature = request.headers.get("stripe-signature")
        
        if not signature:
            raise HTTPException(status_code=400, detail="Missing Stripe signature")
        
        # Handle webhook
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.event_type == "checkout.session.completed":
            # Update transaction and user
            transaction = await db.payment_transactions.find_one({"session_id": webhook_response.session_id})
            if transaction:
                await db.payment_transactions.update_one(
                    {"session_id": webhook_response.session_id},
                    {
                        "$set": {
                            "payment_status": "completed",
                            "updated_at": datetime.utcnow()
                        }
                    }
                )
                
                # Upgrade user to premium
                if transaction["email"] != "anonymous":
                    await db.users.update_one(
                        {"email": transaction["email"]},
                        {
                            "$set": {
                                "is_premium": True,
                                "premium_activated_at": datetime.utcnow(),
                                "subscription_type": transaction["package_id"]
                            }
                        },
                        upsert=True
                    )
        
        return {"status": "success", "event_type": webhook_response.event_type}
        
    except Exception as e:
        logging.error(f"Stripe webhook error: {str(e)}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")

@api_router.get("/verify-session")
async def verify_session(session_id: str):
    """Verify Stripe session and upgrade user to premium"""
    # Mock verification - replace with real Stripe verification
    upgrade = await db.premium_upgrades.find_one({"session_id": session_id})
    
    if not upgrade:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if upgrade["status"] == "completed":
        return {"status": "already_processed", "email": upgrade["email"]}
    
    # Update user to premium
    await db.users.update_one(
        {"email": upgrade["email"]},
        {"$set": {"is_premium": True, "premium_activated_at": datetime.utcnow()}}
    )
    
    # Mark upgrade as completed
    await db.premium_upgrades.update_one(
        {"session_id": session_id},
        {"$set": {"status": "completed", "completed_at": datetime.utcnow()}}
    )
    
    return {"status": "success", "email": upgrade["email"]}

# Legacy routes
@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()