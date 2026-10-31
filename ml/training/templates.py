"""Bilingual (English + Roman Urdu) message templates for TrustLayer corpus (Section 2.3 / Table 2.2).

Covers all 11 regional and psychological categories defined in Table 2.2,
including Pakistani banks (HBL, UBL, Meezan, MCB, Alfalah), mobile wallets &
instant payment rails (EasyPaisa, JazzCash, Raast, SadaPay, NayaPay), BISP /
Ehsaas subsidies, NADRA/FBR/PTA lures, urgent family emergencies, and realistic
benign banking OTPs, personal chats, and utility/e-commerce updates.
"""
import random
from typing import Dict, List, Tuple

BANKS = [
    "HBL", "UBL", "Meezan Bank", "Bank Alfalah", "MCB", "Allied Bank",
    "Faysal Bank", "Askari Bank", "Bank of Punjab", "JS Bank", "Standard Chartered",
]
WALLETS = ["JazzCash", "Easypaisa", "Raast", "SadaPay", "NayaPay", "UPaisa", "Zindigi"]
BRANDS = [
    "Daraz", "Netflix", "Facebook", "WhatsApp", "Telenor", "Jazz", "Zong", "Ufone",
    "TCS", "Pakistan Post", "Bykea", "Careem", "Foodpanda", "Binance", "MetaMask",
]
BAD_DOMAINS = [
    "verify-acct-alert.xyz", "secure-login.top", "bank-notice.cf",
    "prize-center.tk", "hiring-jobs-now.ml", "double-money.ga",
    "account-update-portal.icu", "online-banking-auth.top", "claim-bisp-subsidy.xyz",
    "raast-subsidy-claim.xyz", "sbp-raast-verify.top", "delivery-address-update.cc",
    "usdt-airdrop-reward.click", "quick-loan-approved.live", "kyc-reactivation.vip",
]
GOOD_DOMAINS = [
    "hbl.com", "ubl.com.pk", "meezanbank.com", "jazzcash.com.pk",
    "easypaisa.com.pk", "sbp.org.pk", "daraz.pk", "telenor.com.pk",
    "zong.com.pk", "tcsexpress.com", "pakpost.gov.pk",
]
# Clean currency strings (never double-prefixed in templates)
AMOUNTS_S = [
    "Rs. 2,500", "Rs. 5,000", "Rs. 10,500", "PKR 25,000", "Rs. 50,000",
    "Rs. 85,000", "PKR 120,000", "$150", "500 USDT", "PKR 35,000",
]
AMOUNTS_G = [
    "Rs. 1,250", "PKR 8,540", "Rs. 12,300", "Rs. 940", "PKR 3,200",
    "Rs. 4,600", "PKR 18,250", "Rs. 620", "PKR 45,000", "Rs. 2,180",
]
PHONES = [
    "0300-1234567", "+92 315 7788992", "0321-9988776", "0333-4455667",
    "0345-1122334", "0301-8765432", "+92 304 9876543", "0312-5544332",
]
CITIES = [
    "Karachi", "Lahore", "Islamabad", "Rawalpindi",
    "Faisalabad", "Multan", "Peshawar", "Quetta",
]
NAMES = [
    "Ahmed Raza", "Bilal Khan", "Ayesha Tariq", "Usman Ali",
    "Sara Malik", "Zainab Hussain", "Hamza Sheikh", "Hassan Javed",
]

# Table 2.2: Exact 11-Category Quotas (Total = 6,000: 4,400 Scam + 1,600 Ham)
CATEGORY_QUOTAS: List[Tuple[str, str, int]] = [
    ("scam", "bisp_ehsaas_scam", 550),
    ("scam", "lottery_jeeto_scam", 550),
    ("scam", "banking_kyc_scam", 600),
    ("scam", "wallet_raast_scam", 550),
    ("scam", "job_task_scam", 550),
    ("scam", "investment_crypto_scam", 550),
    ("scam", "delivery_customs_scam", 550),
    ("scam", "urgent_family_scam", 500),
    ("ham", "transactional_otp_ham", 600),
    ("ham", "personal_social_ham", 550),
    ("ham", "promotional_utility_ham", 450),
]

CATEGORY_TEMPLATES: Dict[str, List[str]] = {
    "bisp_ehsaas_scam": [
        "Benazir Income Support Programme: Aap ko {amt_s} ki imdad manzoor ho chuki hai. BISP helpline {phone} pe fori rabta karein.",
        "Ehsaas Kafalat Scheme #{num}: Mubarak ho! Aap ka {amt_s} ka wazifa jari ho gaya hai. Claim link: http://{bad}/bisp",
        "8171 Alert: Your CNIC is approved for BISP relief grant of {amt_s}. Pay biometric verification fee to {phone} today.",
        "Mohtaram sarif, Benazir Kafalat k {amt_s} aap k naam manzoor hain. Tasdeeq k liye apna OTP {phone} par bhejen.",
        "PM Relief Subsidy: Collect your {amt_s} ration & cash grant before {day}/11. Verify CNIC & PIN here: http://{bad}/ehsaas",
        "BISP Head Office {city}: Aap ki imdad ruk gayi hai. Bahali k liye registration charges {amt_s} {wallet} {phone} par jama karain.",
    ],
    "lottery_jeeto_scam": [
        "Congratulations! You have won {amt_s} in the {wallet} lucky draw #{num}. Claim your prize within 2 hours: http://{bad}/claim",
        "You are chosen for Jeeto Pakistan mega bumper prize {amt_s}. Pay delivery charges on {wallet} {phone} to claim.",
        "Aap ko Mubarak ho! Inam Ghar show ki taraf se {amt_s} ka inam jeet chuke hain. File charges k liye {phone} par call karein.",
        "WINNER #{num}: You have been selected for an iPhone 15 & {amt_s} gift voucher from {brand}! Claim now: http://{bad}/win",
        "Lucky draw winner! Your lottery payout of {amt_s} is pending FBR clearance fee. Transfer Rs. 2,000 to {phone} immediately.",
        "Mubarak ho! Aap ka SIM number {brand} bumper قرعہ اندازی me {amt_s} jeet gaya hai. Rabta: {phone}.",
    ],
    "banking_kyc_scam": [
        "Dear customer, your {bank} account ***{tail} will be blocked within 24 hours. Verify immediately: http://{bad}/login?u={num}",
        "Your ATM debit card for {bank} has been suspended. Click here to reactivate and enter your PIN: http://{bad}/card",
        "I am calling from {bank} head office {city}. Share the OTP {otp} sent to you to stop an unauthorized transfer of {amt_s}.",
        "{bank} Security Alert: Unrecognized login detected. Confirm your internet banking password & CVV at http://{bad}/banking",
        "Aap ka {bank} account biometric expiry ki wajah se aaj band ho jayega. Fori tasdeeq karein: http://{bad}/bio",
        "State Bank KYC Notice #{num}: Your {bank} account is frozen. Submit CNIC, card details, and OTP to officer at {phone}.",
        # Subtle / borderline scam without obvious URL
        "{bank} compliance desk: your account ***{tail} requires urgent telephonic PIN re-validation today; call {phone} within 30 minutes.",
    ],
    "wallet_raast_scam": [
        "Your {wallet} wallet has been suspended due to suspicious activity in {city}. Confirm PIN and OTP now: http://{bad}/wallet",
        "SBP Raast Alert: Incoming Raast instant transfer of {amt_s} is on hold. Enter your Raast PIN to receive funds: http://{bad}/raast",
        "Mohtaram sarif, aap ka {wallet} aur Raast ID band kar diya gaya hai. Bahali k liye OTP link par darj karein: http://{bad}/unlock",
        "Raast Subsidy Portal: Link your {bank} account to receive {amt_s} cashback reward. Verify credentials at http://{bad}/raast-id",
        "Easypaisa / JazzCash Merchant Desk: Reversal of {amt_s} initiated on ref #{num}. Share 4-digit PIN with agent {phone} now.",
        "Aap k Raast wallet me ghalti se {amt_s} bhej diye hain, meharbani farma kar foran wapis {phone} par transfer kar dein ya code bataen.",
    ],
    "job_task_scam": [
        "Congratulations! You are shortlisted for a remote job with {brand} partners. Pay {amt_s} registration fee to {phone} for offer letter.",
        "Work from home in {city} and earn Rs. 8,500 daily! Only 3 spots left — send processing fee via {wallet} to {phone} today.",
        "WhatsApp group earning task #{num}: Like YouTube videos & earn {amt_s} per day. Deposit security fee at http://{bad}/jobs",
        "International firm hiring data-entry staff ({name} HR). Monthly pay PKR 90,000. Submit refundable verification fee to {phone}.",
        "Ghar baithe rozana {amt_s} kamayen! Online Amazon/Daraz order boosting task join karne k liye {bad} par register karein.",
        "HR Urgent Notice: Your interview slot #{num} is reserved; transfer medical & portal activation fee of Rs. 1,800 to {phone}.",
    ],
    "investment_crypto_scam": [
        "Invest Rs. 10,000 and receive {amt_s} guaranteed in 7 days! 100% risk-free daily profit — join VIP pool: http://{bad}/invest",
        "Double your money in 48 hours with our AI crypto bot on {brand}. Guaranteed 30% daily ROI! Last 4 slots: http://{bad}/bot",
        "GUARANTEED PROFIT #{num}: Forex & Gold VIP signals yielding 25% weekly return without loss. Deposit via Raast/USDT to {phone}.",
        "Exclusive {wallet} wealth multiplier: deposit {amt_s} today and withdraw double tomorrow. Official link: http://{bad}/wealth",
        "Halal crypto staking scheme {city}: rozana pakka munafa {amt_s}! Abhi {phone} par sarmaya bhejen aur fori payout hasil karein.",
        "Private equity alert for {name}: guaranteed 18% weekly dividend if capital is wired within 2 hours to account ref #{num}.",
    ],
    "delivery_customs_scam": [
        "{brand} Courier: Parcel #{num} cannot be delivered in {city} due to incomplete address. Update & pay Rs. 199 fee: http://{bad}/track",
        "Pakistan Customs Alert: Shipment #{num} detained at {city} airport. Pay customs duty {amt_s} immediately: http://{bad}/customs",
        "PTA DIRBS Final Warning: Your mobile IMEI will be blocked tonight. Pay PTA tax {amt_s} online now: http://{bad}/pta",
        "LESCO / K-Electric Notice: Electricity meter #{num} will be disconnected at 8 PM for unpaid bill. Call officer {phone} to pay now.",
        "FBR Tax Notice #{num}: Legal warrant issued for non-filer status. Pay penalty {amt_s} immediately via http://{bad}/fbr to avoid arrest.",
        "Pakistan Post {city}: Aap ka parcel hold par hai. Address confirm karne aur charges dene k liye click karein: http://{bad}/post",
    ],
    "urgent_family_scam": [
        "Ammi mera accident ho gaya hai {city} road pe, mera phone toot gaya hai, dost {name} k number {phone} pe foran {amt_s} {wallet} bhej dein!",
        "Salam bhai, I am stuck at {city} hospital emergency with no cash and my bank app is locked. Urgent send {amt_s} via Raast to {phone}.",
        "Papa police ne gari rok li hai challan aur थाने k mamlay me foran {amt_s} is {wallet} number {phone} pe transfer kar dein kisi ko mat batana.",
        "Hi Mom, dropped my phone in water! Texting from a friend's number {phone}. Need {amt_s} urgently to pay urgent medical bill right now.",
        "Yaar {name} bol raha hoon, meri walida ICU me admit hain {city} me, fori tor par {amt_s} Raast kar do sham tak wapis kar dunga: {phone}.",
        "Urgent family emergency! Cousin had a bike crash near {city}, hospital requires {amt_s} advance deposit immediately on {wallet} {phone}.",
    ],
    "transactional_otp_ham": [
        "Your OTP for {bank} mobile banking login is {otp}. Never share this code with anyone, including bank staff.",
        "{bank} Alert: {amt_g} debited from account ***{tail} on {day}/10 via Raast to {name}. Avl Bal: PKR 42,810. Call 111-222-333 if unauthorized.",
        "{bank}: {amt_g} credited to your account ***{tail} via SBP Raast IBFT (Ref #{num}). Available balance: PKR 68,400.",
        "Your {wallet} verification code is {otp}. Do not share this PIN or OTP with anyone. {wallet} never calls asking for codes.",
        "Your {wallet} transfer of {amt_g} to {name} was successful on {day}/10. Transaction ID: TXN{num}.",
        "Monthly e-statement for your {bank} account ending in {tail} has been generated. View securely inside your official mobile app.",
        "{bank} Security Reminder: Neither {bank} nor State Bank Raast will ever ask for your password, ATM PIN, CVV, or OTP via SMS or call.",
    ],
    "personal_social_ham": [
        "Hi {name}, are we still meeting for lunch tomorrow at {hour} PM in {city}? Let me know what time works best.",
        "Ammi main khairiyat se {city} pohanch gaya hoon, meeting k baad raat ko call karunga InshaAllah.",
        "Assalam o Alaikum, our FYP group meeting is moved to Room {day}B at {hour}:30 PM today. Please bring your laptop and notes.",
        "Bhai ghar aate waqt bakery se bread, doodh aur anday le aana, mehmaan aa rahe hain sham ko.",
        "Doctor appointment reminder: {name}, your checkup at {city} clinic is confirmed for {day}/11 at {hour}:00 PM.",
        "Hey! Left my charger and notebook on the study table, please keep them safe until Monday morning.",
        "Happy birthday {name}! Wishing you great health and success this year. Dinner at our place tonight at {hour}?",
    ],
    "promotional_utility_ham": [
        "{brand}: Your monthly bill of {amt_g} for consumer ID #{num} has been generated. Due date is {day}/11/2026.",
        "Your order #{num} from {brand} has been dispatched via TCS and will arrive in {city} within 2-3 working days: https://{good}/track/{num}",
        "{brand} Weekly Super Bundle: 10GB data & 500 mins activated for {amt_g}. Valid till {day}/11. Dial *707# to check remaining MBs.",
        "Thank you for paying your electricity bill of {amt_g} through {wallet} (Ref #{num}). Keep saving energy!",
        "Your {brand} rider {name} is arriving in 10 minutes with order #{num}. Delivery confirmation code at doorstep is {otp}.",
        "PIA Flight PK-{tail}: Web check-in is now open for your {city} departure. Boarding gates close 45 minutes prior to takeoff.",
    ],
}

# Flat lists preserved for backwards compatibility with any external callers
SCAM_TEMPLATES: List[str] = [
    tpl
    for label, cat, _ in CATEGORY_QUOTAS
    if label == "scam"
    for tpl in CATEGORY_TEMPLATES[cat]
]
HAM_TEMPLATES: List[str] = [
    tpl
    for label, cat, _ in CATEGORY_QUOTAS
    if label == "ham"
    for tpl in CATEGORY_TEMPLATES[cat]
]


def fill(templates: List[str], rng: random.Random = random) -> str:
    """Fill one random template with randomized slot values and zero duplicate prefixes."""
    t = rng.choice(templates)
    return t.format(
        bank=rng.choice(BANKS),
        wallet=rng.choice(WALLETS),
        brand=rng.choice(BRANDS),
        bad=rng.choice(BAD_DOMAINS),
        good=rng.choice(GOOD_DOMAINS),
        amt_s=rng.choice(AMOUNTS_S),
        amt_g=rng.choice(AMOUNTS_G),
        phone=rng.choice(PHONES),
        city=rng.choice(CITIES),
        name=rng.choice(NAMES),
        day=rng.randint(1, 28),
        hour=rng.randint(1, 11),
        tail=rng.randint(1001, 9998),
        otp=rng.randint(100000, 999999),
        num=rng.randint(10000, 999999),
    )


def fill_category(category: str, rng: random.Random = random) -> str:
    """Generate one message for a specific Table 2.2 category."""
    return fill(CATEGORY_TEMPLATES[category], rng=rng)
