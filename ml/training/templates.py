"""Message templates for synthetic dataset generation (scam + ham)."""
import random

BANKS = [
    "HBL", "UBL", "Meezan Bank", "Bank Alfalah", "MCB", "Allied Bank",
    "Faysal Bank", "Askari Bank", "Bank of Punjab", "JS Bank", "Standard Chartered"
]
WALLETS = ["JazzCash", "Easypaisa", "Sadapay", "NayaPay", "UPaisa", "Zindigi"]
BRANDS = [
    "Daraz", "Netflix", "Facebook", "WhatsApp", "Telenor", "Jazz", "Zong", "Ufone",
    "TCS", "Pakistan Post", "Bykea", "Careem", "Foodpanda", "Binance", "MetaMask"
]
BAD_DOMAINS = [
    "verify-acct-alert.xyz", "secure-login.top", "bank-notice.cf",
    "prize-center.tk", "hiring-jobs-now.ml", "double-money.ga",
    "account-update-portal.icu", "online-banking-auth.top", "claim-bisp-subsidy.xyz",
    "delivery-address-update.cc", "usdt-airdrop-reward.click", "quick-loan-approved.live",
    "crypto-daily-income.online", "kyc-reactivation.vip", "ptcl-bill-discount.link"
]
GOOD_DOMAINS = [
    "hbl.com", "ubl.com.pk", "meezanbank.com", "jazzcash.com.pk",
    "easypaisa.com.pk", "daraz.pk", "telenor.com.pk", "zong.com.pk",
    "tcsexpress.com", "pakpost.gov.pk"
]
AMOUNTS_S = [
    "Rs. 2,500", "Rs. 5,000", "Rs. 10,000", "PKR 25,000", "Rs. 50,000",
    "Rs. 85,000", "PKR 120,000", "$100", "500 USDT", "0.05 BTC"
]
AMOUNTS_G = [
    "Rs. 1,250", "PKR 8,540", "Rs. 12,300", "Rs. 940", "PKR 3,200",
    "Rs. 4,600", "PKR 18,250", "Rs. 620", "PKR 45,000"
]
PHONES = [
    "0300-1234567", "+92 315 7788992", "0321-9988776", "0333-4455667",
    "0345-1122334", "0301-8765432", "+92 304 9876543", "0312-5544332"
]
CITIES = ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Quetta"]

SCAM_TEMPLATES = [
    # phishing / account verification
    "Dear customer, your {bank} account will be blocked within 24 hours. Verify immediately: http://{bad}/login?u={phone}",
    "Your {wallet} wallet has been suspended due to suspicious activity. Confirm your PIN and CVV now at http://{bad}",
    "URGENT: {brand} account verification required. Act now or your account will be permanently closed: http://{bad}/verify",
    "Attention! Your account will be closed today. Update your password and card details here: http://{bad}",
    "Final warning: verify your identity within 10 minutes or lose access. Enter your OTP: http://{bad}/otp",
    "Your biometric verification has expired for {bank}. Update online immediately: http://{bad}/bio",
    "Security Notice: Unrecognized login from {city} on {wallet}. Lock here: http://{bad}/lock",
    # banking fraud
    "Your ATM card has been blocked. Click here to reactivate immediately: http://{bad} — {bank} security team",
    "I am calling from {bank} head office. Share the OTP sent to you to stop an unauthorized transaction of {amt_s}.",
    "{bank}: unauthorized login detected. Confirm your internet banking password at http://{bad}/banking",
    "This is the {bank} fraud department. To reverse the deduction of {amt_s}, transfer the verification amount to our officer now.",
    "Your SIM will be deactivated today. Re-register your SIM by sharing your CNIC and OTP with this number {phone}",
    "State Bank Alert: Your {bank} account is on hold. Transfer {amt_s} to clear restrictions: {phone}",
    "Alert: Deducted {amt_s} from your card. Immediately reset ATM PIN at http://{bad}/cancel",
    # job scams
    "Congratulations! You have been selected for a remote job. Pay Rs. 2,500 registration fee via JazzCash to {phone} to receive your offer letter.",
    "Work from home and earn Rs. 8,000 daily! Limited to 5 spots — send processing fee of {amt_s} on Easypaisa to register today.",
    "You are shortlisted for a WhatsApp group earning job. Deposit the security deposit of {amt_s} to start daily payouts.",
    "Hiring alert: simple copy-paste work, daily income Rs. 5,000. Only 2 positions remaining — pay advance charges now!",
    "Online Part-time Job Offer: Review YouTube videos and earn Rs. 6,000 daily. Pay training fee {amt_s} to {phone}",
    "International company hiring data entry staff in {city}. Basic salary Rs. 75,000. Send {amt_s} doc verification fee: {phone}",
    # investment scams
    "Invest Rs. 10,000 and receive Rs. 50,000 guaranteed in 7 days! 100% daily profit, risk free income — join now: http://{bad}",
    "Double your money in 72 hours with our crypto trading bot. Guaranteed ROI 30% daily. Last chance to invest!",
    "GUARANTEED PROFIT: our forex signals team offers 25% weekly return, risk-free. Only 3 slots left, register now: http://{bad}",
    "Exclusive {brand} VIP Investment Pool: Earn 40% monthly returns without risk. Deposit USDT now at http://{bad}/pool",
    "Auto-trading AI bot generates {amt_s} passive income daily. Deposit starting capital into {wallet} {phone} today!",
    # prize scams
    "Congratulations! You have won Rs. 50,000 in the {wallet} lucky draw. Claim your prize within 2 hours: http://{bad}/claim",
    "You've won an iPhone 15 in the {brand} giveaway! Send the courier fee of Rs. 1,500 to claim your prize today.",
    "WINNER: you have been selected to receive a free data bundle of 25GB. Click to claim your reward: http://{bad}",
    "Lucky draw winner! Your prize of {amt_s} is waiting. Pay the tax of Rs. 3,000 first to release your lottery winnings.",
    "You are chosen for Jeeto Pakistan mega bumper prize {amt_s}. Pay delivery charges on {wallet} {phone} to claim.",
    # impersonation & threats
    "This is FBR tax department. A case has been registered against you. Pay the penalty of {amt_s} immediately to avoid arrest.",
    "I am officer from NADRA. Your ID card is involved in money laundering. Share your card number and OTP to clear your name.",
    "Dear customer, this is the police cyber crime unit. Send your account details for verification or legal action will be taken against you.",
    "Sincerely, {bank} Management. Your KYC has expired; confirm your account number and CVV through the link: http://{bad}",
    "PTA Final Warning: Your mobile IMEI will be blocked. Pay PTA tax {amt_s} online immediately: http://{bad}/pta",
    "Traffic Police Challan Alert: Unpaid violation recorded in {city}. Pay fine {amt_s} or face license suspension: http://{bad}/challan",
    # delivery, utilities & Roman Urdu scams
    "{brand} Notice: Your parcel cannot be delivered due to incomplete address. Confirm delivery address now: http://{bad}/track",
    "Delivery attempt failed! Your shipment #{num} is pending customs clearance. Pay customs duty {amt_s} here: http://{bad}/pay",
    "Pakistan Post: Package on hold at {city} distribution center. Update recipient contact details: http://{bad}/post",
    "Benazir Income Support Programme: Aap ko {amt_s} ki imdad manzoor ho chuki hai. BISP helpline {phone} pe rabta karein.",
    "Ehsaas Kafalat Scheme: Mubarak ho! Aap ka {amt_s} ka wazifa aya hai. Hasil karne ke liye call karein {phone}.",
    "Mohtaram sarif, aap ka {wallet} account band kar diya gaya hai. Fori bahali k liye OTP aur PIN link par darj karein: http://{bad}",
    "Ammi mera accident ho gaya hai mera phone toot gaya hai dost k number {phone} pe foran {amt_s} JazzCash bhej dein.",
    "LESCO / K-Electric Alert: Bill adam adaigi ki soorat me bijli ka connection aaj kat jaye ga. Bachao k liye {phone} par call karein.",
    "Aap ko Mubarak ho! Inam Ghar show ki taraf se {amt_s} ka prize jeet chuke hain. Claim k liye {phone} par rabta karein.",
    "Aap ka {bank} debit card block ho chuka hai. Dobara chalane k liye apna card number aur password SMS karein.",
]

HAM_TEMPLATES = [
    # Banking alerts & OTPs
    "Your OTP for {bank} mobile banking login is 483920. Never share this code with anyone.",
    "{bank}: Rs. {amt_g} debited from account ***4421 on {day}/09. Balance: Rs. 15,780. Call 111-444-555 if not you.",
    "{bank}: Rs. {amt_g} credited to your account ***9034. Available balance Rs. 42,100.",
    "Your verification code is 771240. Do not share this code with anyone — {wallet}",
    "Your {wallet} transfer of {amt_g} to Ahmed Raza was successful. Ref no: JC{num}.",
    "{wallet}: bill payment of Rs. {amt_g} successful. You have earned 50 cashback points.",
    "Your monthly e-statement for {bank} account ending in 7102 is ready for download in your online portal.",
    "{bank} security reminder: We never ask for your PIN, password, or OTP via phone call or SMS.",
    # Delivery & e-commerce
    "Your parcel from {brand} has been dispatched and will arrive in 2-3 working days. Track at https://{good}/track{num}",
    "Thank you for shopping at {brand}. Your order #{num} has been confirmed. Expected delivery: Friday.",
    "Your {brand} delivery rider is on the way. Pin code for delivery confirmation is 3821.",
    "Return request for order #{num} has been received. Our rider will collect the package within 48 hours.",
    # Telecom & utility bills
    "{brand}: Your monthly bill of Rs. {amt_g} has been generated. Due date is {day}/10/2026.",
    "{brand} weekly bundle: 5GB data activated successfully. Valid till {day}/09. UNSUB to stop.",
    "Electricity bill for September: Rs. {amt_g}. Pay before {day}/09 to avoid surcharge. LESCO.",
    "Your Sui Gas bill of Rs. {amt_g} has been paid via {wallet}. Thank you for your payment.",
    "{brand} recharge of Rs. {amt_g} was successful. Current balance is Rs. 1,450. Dial *111# for details.",
    # Personal messages & social
    "Hi, are we still meeting for lunch tomorrow? Let me know what time works for you.",
    "Mom, I reached {city} safely. Will call you after the meeting.",
    "Assalam o Alaikum, the society meeting is rescheduled to Sunday 11 AM in {city}. Please confirm your attendance.",
    "Happy birthday! May you have a wonderful year ahead. Party at our place this weekend?",
    "Study group moved to 7pm tonight in the library, room 2B. See you there!",
    "Please review the attached project report and share your feedback by Friday evening. Thanks, Sara.",
    "Doctor reminder: your dental checkup appointment is confirmed for tomorrow at 4:30 PM.",
    "Hey! Left my car keys on the kitchen counter, can you please keep them safe?",
    "Your flight PK-305 check-in is now open. Web check-in closes 3 hours before departure.",
    "Your salary for September has been credited: PKR 95,000. — HR Department",
    "Bhai, ghar aate waqt fresh milk aur bread le aana please.",
    "Class tomorrow is canceled because the professor is unwell. We will meet on Monday instead.",
]


def fill(templates: list) -> str:
    """Fill one random template with randomized slot values."""
    t = random.choice(templates)
    return t.format(
        bank=random.choice(BANKS),
        wallet=random.choice(WALLETS),
        brand=random.choice(BRANDS),
        bad=random.choice(BAD_DOMAINS),
        good=random.choice(GOOD_DOMAINS),
        amt_s=random.choice(AMOUNTS_S),
        amt_g=random.choice(AMOUNTS_G),
        phone=random.choice(PHONES),
        city=random.choice(CITIES),
        day=random.randint(1, 28),
        num=random.randint(10000, 999999),
    )

