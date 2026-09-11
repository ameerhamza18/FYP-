"""Message templates for synthetic dataset generation (scam + ham)."""
import random

BANKS = ["HBL", "UBL", "Meezan Bank", "Bank Alfalah", "MCB", "Allied Bank"]
WALLETS = ["JazzCash", "Easypaisa", "Sadapay", "NayaPay"]
BRANDS = ["Daraz", "Netflix", "Facebook", "WhatsApp", "Telenor", "Jazz", "Zong", "Ufone"]
BAD_DOMAINS = ["verify-acct-alert.xyz", "secure-login.top", "bank-notice.cf",
               "prize-center.tk", "hiring-jobs-now.ml", "double-money.ga"]
GOOD_DOMAINS = ["hbl.com", "jazzcash.com.pk", "easypaisa.com.pk", "daraz.pk", "telenor.com.pk"]
AMOUNTS_S = ["Rs. 2,500", "Rs. 5,000", "Rs. 10,000", "PKR 25,000", "Rs. 50,000", "$100"]
AMOUNTS_G = ["Rs. 1,250", "PKR 8,540", "Rs. 12,300", "Rs. 940", "PKR 3,200"]
PHONES = ["0300-1234567", "+92 315 7788992", "0321-9988776", "0333-4455667"]

SCAM_TEMPLATES = [
    # phishing / account verification
    "Dear customer, your {bank} account will be blocked within 24 hours. Verify immediately: http://{bad}/login?u={phone}",
    "Your {wallet} wallet has been suspended due to suspicious activity. Confirm your PIN and CVV now at http://{bad}",
    "URGENT: {brand} account verification required. Act now or your account will be permanently closed: http://{bad}/verify",
    "Attention! Your account will be closed today. Update your password and card details here: http://{bad}",
    "Final warning: verify your identity within 10 minutes or lose access. Enter your OTP: http://{bad}/otp",
    # banking fraud
    "Your ATM card has been blocked. Click here to reactivate immediately: http://{bad} — {bank} security team",
    "I am calling from {bank} head office. Share the OTP sent to you to stop an unauthorized transaction of {amt_s}.",
    "{bank}: unauthorized login detected. Confirm your internet banking password at http://{bad}/banking",
    "This is the {bank} fraud department. To reverse the deduction of {amt_s}, transfer the verification amount to our officer now.",
    "Your SIM will be deactivated today. Re-register your SIM by sharing your CNIC and OTP with this number {phone}",
    # job scams
    "Congratulations! You have been selected for a remote job. Pay Rs. 2,500 registration fee via JazzCash to {phone} to receive your offer letter.",
    "Work from home and earn Rs. 8,000 daily! Limited to 5 spots — send processing fee of {amt_s} on Easypaisa to register today.",
    "You are shortlisted for a WhatsApp group earning job. Deposit the security deposit of {amt_s} to start daily payouts.",
    "Hiring alert: simple copy-paste work, daily income Rs. 5,000. Only 2 positions remaining — pay advance charges now!",
    # investment scams
    "Invest Rs. 10,000 and receive Rs. 50,000 guaranteed in 7 days! 100% daily profit, risk free income — join now: http://{bad}",
    "Double your money in 72 hours with our crypto trading bot. Guaranteed ROI 30% daily. Last chance to invest!",
    "GUARANTEED PROFIT: our forex signals team offers 25% weekly return, risk-free. Only 3 slots left, register now: http://{bad}",
    # prize scams
    "Congratulations! You have won Rs. 50,000 in the {wallet} lucky draw. Claim your prize within 2 hours: http://{bad}/claim",
    "You've won an iPhone 15 in the {brand} giveaway! Send the courier fee of Rs. 1,500 to claim your prize today.",
    "WINNER: you have been selected to receive a free data bundle of 25GB. Click to claim your reward: http://{bad}",
    "Lucky draw winner! Your prize of {amt_s} is waiting. Pay the tax of Rs. 3,000 first to release your lottery winnings.",
    # impersonation
    "This is FBR tax department. A case has been registered against you. Pay the penalty of {amt_s} immediately to avoid arrest.",
    "I am officer from NADRA. Your ID card is involved in money laundering. Share your card number and OTP to clear your name.",
    "Dear customer, this is the police cyber crime unit. Send your account details for verification or legal action will be taken against you.",
    "Sincerely, {bank} Management. Your KYC has expired; confirm your account number and CVV through the link: http://{bad}",
]

HAM_TEMPLATES = [
    "Your OTP for {bank} mobile banking login is 483920. Never share this code with anyone.",
    "{bank}: Rs. {amt_g} debited from account ***4421 on {day}/09. Balance: Rs. 15,780. Call 111-444-555 if not you.",
    "Your {wallet} transfer of {amt_g} to Ahmed Raza was successful. Ref no: JC{num}.",
    "Hi, are we still meeting for lunch tomorrow? Let me know what time works for you.",
    "Your parcel from {brand} has been dispatched and will arrive in 2-3 working days. Track at https://{good}/track{num}",
    "Mom, I reached Lahore safely. Will call you after the meeting.",
    "{brand}: Your monthly bill of Rs. {amt_g} has been generated. Due date is {day}/10/2026.",
    "Thank you for shopping at {brand}. Your order #{num} has been confirmed. Expected delivery: Friday.",
    "Reminder: your physiotherapy appointment is scheduled for Thursday at 5 PM at Shifa Clinic.",
    "{bank}: Rs. {amt_g} credited to your account ***9034. Available balance Rs. 42,100.",
    "Your verification code is 771240. Do not share this code with anyone — {wallet}",
    "Study group moved to 7pm tonight in the library, room 2B. See you there!",
    "{brand} weekly bundle: 5GB data activated successfully. Valid till {day}/09. UNSUB to stop.",
    "Assalam o Alaikum, the society meeting is rescheduled to Sunday 11 AM. Please confirm your attendance.",
    "Your flight PK-305 check-in is now open. Web check-in closes 3 hours before departure.",
    "Electricity bill for September: Rs. {amt_g}. Pay before {day}/09 to avoid surcharge. LESCO.",
    "Happy birthday! May you have a wonderful year ahead. Party at our place this weekend?",
    "Your salary for September has been credited: PKR 95,000. — HR Department",
    "{wallet}: bill payment of Rs. {amt_g} successful. You have earned 50 cashback points.",
    "Please review the attached project report and share your feedback by Friday evening. Thanks, Sara.",
]


def fill(templates: list) -> str:
    """Fill one random template with randomized slot values."""
    t = random.choice(templates)
    return t.format(
        bank=random.choice(BANKS), wallet=random.choice(WALLETS),
        brand=random.choice(BRANDS), bad=random.choice(BAD_DOMAINS),
        good=random.choice(GOOD_DOMAINS), amt_s=random.choice(AMOUNTS_S),
        amt_g=random.choice(AMOUNTS_G), phone=random.choice(PHONES),
        day=random.randint(1, 28), num=random.randint(10000, 999999),
    )

