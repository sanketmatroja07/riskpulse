"""
Seed data generator for RiskPulse.
Generates: 60 users, 40 devices, 120 IPs, 30 merchants, 200+ transactions,
25 alerts, 10 cases with varying outcomes.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import uuid
import random
import hashlib
from datetime import datetime, timedelta
import bcrypt


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

# Check if already seeded
def is_seeded():
    from sqlalchemy import create_engine, text, inspect
    from config import get_settings
    settings = get_settings()
    engine = create_engine(settings.DATABASE_URL_SYNC)
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return False
    with engine.connect() as conn:
        result = conn.execute(text("SELECT COUNT(*) FROM users"))
        count = result.scalar()
        return count > 0


def seed():
    if is_seeded():
        print("Database already seeded, skipping.")
        return

    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from config import get_settings
    from models.database import Base

    settings = get_settings()
    engine = create_engine(settings.DATABASE_URL_SYNC)

    # Create all tables (works for both SQLite and Postgres)
    Base.metadata.create_all(engine)

    Session = sessionmaker(bind=engine)
    db = Session()

    print("Seeding database...")
    random.seed(42)  # Deterministic

    # ================================================================
    # ORGANIZATION (multi-tenancy)
    # ================================================================
    from models.database import Organization
    org_id = uuid.uuid5(uuid.NAMESPACE_DNS, "riskpulse-demo")
    org = Organization(
        id=org_id,
        name="RiskPulse Demo",
        slug="riskpulse-demo",
        plan="pro",
        event_quota=100000,
        max_members=15,
    )
    db.add(org)
    db.flush()
    print(f"  Created demo organization: {org.name}")

    # ================================================================
    # PLATFORM USERS (login accounts)
    # ================================================================
    platform_users = []
    user_configs = [
        ("admin@riskpulse.io", "Admin User", "admin"),
        ("sarah.chen@riskpulse.io", "Sarah Chen", "analyst"),
        ("james.wilson@riskpulse.io", "James Wilson", "analyst"),
        ("maria.garcia@riskpulse.io", "Maria Garcia", "analyst"),
        ("alex.kumar@riskpulse.io", "Alex Kumar", "engineer"),
        ("lisa.park@riskpulse.io", "Lisa Park", "engineer"),
        ("viewer@riskpulse.io", "Demo Viewer", "readonly"),
    ]

    for email, name, role in user_configs:
        u_id = uuid.uuid5(uuid.NAMESPACE_DNS, email)
        from models.database import User
        user = User(
            id=u_id,
            org_id=org_id,
            email=email,
            name=name,
            password_hash=hash_password("riskpulse123"),
            role=role,
            is_active=True
        )
        db.add(user)
        platform_users.append(user)

    db.flush()
    print(f"  Created {len(platform_users)} platform users")

    # ================================================================
    # ENTITIES
    # ================================================================
    from models.database import Entity, EntityEdge

    # 60 user entities
    user_entities = []
    first_names = ["John", "Jane", "Bob", "Alice", "Charlie", "Diana", "Eve", "Frank", "Grace", "Henry",
                   "Ivy", "Jack", "Kate", "Leo", "Mia", "Nick", "Olivia", "Paul", "Quinn", "Rachel",
                   "Sam", "Tara", "Uma", "Victor", "Wendy", "Xavier", "Yara", "Zack", "Anna", "Brian",
                   "Chloe", "David", "Elena", "Felix", "Gina", "Hugo", "Iris", "Jason", "Kelly", "Lucas",
                   "Maya", "Nathan", "Opal", "Peter", "Quincy", "Rita", "Steve", "Tina", "Uri", "Vera",
                   "Will", "Xena", "Yuri", "Zara", "Amit", "Beth", "Carl", "Dina", "Erik", "Fiona"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
                  "Anderson", "Taylor", "Thomas", "Hernandez", "Moore", "Martin", "Jackson", "Thompson", "White", "Lopez"]

    for i in range(60):
        fn = first_names[i]
        ln = last_names[i % len(last_names)]
        ext_id = f"USR-{10000 + i}"
        risk = round(random.uniform(0, 0.4), 2) if i < 45 else round(random.uniform(0.5, 0.95), 2)
        days_ago = random.randint(30, 365)

        ue = Entity(
            id=uuid.uuid5(uuid.NAMESPACE_DNS, ext_id),
            org_id=org_id,
            entity_type="user",
            external_id=ext_id,
            display_name=f"{fn} {ln}",
            metadata_={
                "email": f"{fn.lower()}.{ln.lower()}@email.com",
                "phone": f"+1555{random.randint(1000000, 9999999)}",
                "country": random.choice(["US", "US", "US", "US", "GB", "CA", "DE", "FR", "AU"]),
                "account_age_days": days_ago,
                "verified": random.random() > 0.2
            },
            risk_score=risk,
            first_seen_at=datetime.utcnow() - timedelta(days=days_ago),
            last_seen_at=datetime.utcnow() - timedelta(hours=random.randint(0, 72))
        )
        db.add(ue)
        user_entities.append(ue)

    # 40 devices
    device_entities = []
    for i in range(40):
        ext_id = f"DEV-{hashlib.md5(f'device_{i}'.encode()).hexdigest()[:12]}"
        de = Entity(
            id=uuid.uuid5(uuid.NAMESPACE_DNS, ext_id),
            org_id=org_id,
            entity_type="device",
            external_id=ext_id,
            display_name=f"Device {ext_id[:8]}",
            metadata_={
                "os": random.choice(["iOS 17", "iOS 16", "Android 14", "Android 13", "Windows 11", "macOS 14"]),
                "browser": random.choice(["Safari", "Chrome", "Firefox", "Edge"]),
                "screen": random.choice(["1920x1080", "1440x900", "2560x1440", "390x844"]),
                "language": random.choice(["en-US", "en-GB", "es-ES", "fr-FR", "de-DE"])
            },
            risk_score=round(random.uniform(0, 0.3), 2) if i < 30 else round(random.uniform(0.5, 0.9), 2),
            first_seen_at=datetime.utcnow() - timedelta(days=random.randint(10, 200))
        )
        db.add(de)
        device_entities.append(de)

    # 120 IPs
    ip_entities = []
    for i in range(120):
        octets = [random.randint(1, 254) for _ in range(4)]
        ip_str = f"{octets[0]}.{octets[1]}.{octets[2]}.{octets[3]}"
        ext_id = ip_str
        is_suspicious = i >= 90

        ie = Entity(
            id=uuid.uuid5(uuid.NAMESPACE_DNS, f"ip_{ext_id}"),
            org_id=org_id,
            entity_type="ip",
            external_id=ext_id,
            display_name=ext_id,
            metadata_={
                "country": random.choice(["US", "US", "US", "GB", "CA", "DE"]) if not is_suspicious
                          else random.choice(["RO", "NG", "BY", "UA", "CN"]),
                "city": random.choice(["New York", "San Francisco", "Chicago", "London", "Toronto"]) if not is_suspicious
                       else random.choice(["Bucharest", "Lagos", "Minsk", "Kyiv"]),
                "isp": random.choice(["Comcast", "AT&T", "Verizon", "BT"]) if not is_suspicious
                      else random.choice(["VPN Provider", "Tor Exit", "Datacenter"]),
                "is_proxy": is_suspicious and random.random() > 0.5,
                "is_tor": is_suspicious and random.random() > 0.8
            },
            risk_score=round(random.uniform(0, 0.2), 2) if not is_suspicious else round(random.uniform(0.6, 1.0), 2),
            first_seen_at=datetime.utcnow() - timedelta(days=random.randint(1, 180))
        )
        db.add(ie)
        ip_entities.append(ie)

    # 30 cards
    card_entities = []
    for i in range(30):
        last4 = f"{random.randint(1000, 9999)}"
        bin_prefix = random.choice(["4111", "5500", "3782", "6011"])
        ext_id = f"CARD-****{last4}"

        ce = Entity(
            id=uuid.uuid5(uuid.NAMESPACE_DNS, f"card_{ext_id}_{i}"),
            org_id=org_id,
            entity_type="card",
            external_id=ext_id,
            display_name=f"{bin_prefix}****{last4}",
            metadata_={
                "bin": bin_prefix,
                "last4": last4,
                "brand": {"4111": "Visa", "5500": "Mastercard", "3782": "Amex", "6011": "Discover"}[bin_prefix],
                "country": random.choice(["US", "US", "GB", "CA"]),
                "type": random.choice(["credit", "debit"])
            },
            risk_score=round(random.uniform(0, 0.3), 2)
        )
        db.add(ce)
        card_entities.append(ce)

    # 30 merchants
    merchant_entities = []
    merchant_names = [
        "TechGadgets Pro", "Fashion Hub", "Grocery Express", "Auto Parts Plus",
        "Digital Games Store", "Travel Booker", "Pharmacy Direct", "Electronics World",
        "Pet Supplies Co", "Home & Garden", "Sports Gear", "Book Haven",
        "Music Stream", "Cloud Services Inc", "Coffee Bean Shop", "Fitness Zone",
        "Jewelry Palace", "Wine Cellar", "Toy Factory", "Office Depot",
        "Art Supplies", "Camera World", "Shoe Warehouse", "Beauty Bar",
        "Phone Repair", "Car Wash Pro", "Pizza Palace", "Streaming Plus",
        "Gift Cards Unlimited", "Crypto Exchange"
    ]
    categories = ["electronics", "fashion", "grocery", "automotive", "gaming",
                  "travel", "pharmacy", "electronics", "pets", "home",
                  "sports", "books", "entertainment", "saas", "food",
                  "fitness", "jewelry", "beverages", "toys", "office",
                  "art", "electronics", "fashion", "beauty", "services",
                  "services", "food", "entertainment", "gift_cards", "crypto"]

    for i in range(30):
        ext_id = f"MRC-{10000 + i}"
        me = Entity(
            id=uuid.uuid5(uuid.NAMESPACE_DNS, ext_id),
            org_id=org_id,
            entity_type="merchant",
            external_id=ext_id,
            display_name=merchant_names[i],
            metadata_={
                "category": categories[i],
                "country": random.choice(["US", "US", "US", "GB", "CA"]),
                "mcc": str(random.randint(3000, 9999)),
                "high_risk": i >= 25
            },
            risk_score=round(random.uniform(0, 0.2), 2) if i < 25 else round(random.uniform(0.5, 0.8), 2)
        )
        db.add(me)
        merchant_entities.append(me)

    db.flush()
    print(f"  Created entities: {len(user_entities)} users, {len(device_entities)} devices, {len(ip_entities)} IPs, {len(card_entities)} cards, {len(merchant_entities)} merchants")

    # ================================================================
    # ENTITY EDGES (graph relationships)
    # ================================================================
    edges_added = 0
    seen_edges = set()  # Track (source, target, type) to avoid UNIQUE violations

    def add_edge(src_id, tgt_id, etype, w):
        nonlocal edges_added
        key = (str(src_id), str(tgt_id), etype)
        if key in seen_edges:
            return
        seen_edges.add(key)
        db.add(EntityEdge(
            org_id=org_id,
            source_entity_id=src_id,
            target_entity_id=tgt_id,
            edge_type=etype,
            weight=w
        ))
        edges_added += 1

    # User -> Device (each user has 1-3 devices)
    for i, ue in enumerate(user_entities):
        num_devices = random.randint(1, 3)
        for _ in range(num_devices):
            de = random.choice(device_entities)
            add_edge(ue.id, de.id, "uses_device", round(random.uniform(0.5, 1.0), 2))

    # User -> IP (each user has 1-4 IPs)
    for ue in user_entities:
        num_ips = random.randint(1, 4)
        for _ in range(num_ips):
            ie = random.choice(ip_entities)
            add_edge(ue.id, ie.id, "uses_ip", round(random.uniform(0.3, 1.0), 2))

    # User -> Card
    for i, ue in enumerate(user_entities):
        ce = card_entities[i % len(card_entities)]
        add_edge(ue.id, ce.id, "owns_card", 1.0)

    # Suspicious clusters: make some users share devices and IPs
    suspicious_users = user_entities[45:55]
    shared_device = device_entities[35]
    shared_ip = ip_entities[100]
    for su in suspicious_users:
        add_edge(su.id, shared_device.id, "uses_device", 0.9)
        add_edge(su.id, shared_ip.id, "uses_ip", 0.9)

    db.flush()
    print(f"  Created {edges_added} entity edges")

    # ================================================================
    # EVENTS & TRANSACTIONS
    # ================================================================
    from models.database import Event, Transaction

    events = []
    transactions = []
    event_types = ["transaction", "login_attempt", "password_reset", "card_added", "address_change", "email_change"]

    for i in range(220):
        ue = random.choice(user_entities)
        de = random.choice(device_entities)
        ie = random.choice(ip_entities)
        me = random.choice(merchant_entities)
        ce = card_entities[user_entities.index(ue) % len(card_entities)]

        hours_ago = random.randint(0, 168)  # Last 7 days
        occurred = datetime.utcnow() - timedelta(hours=hours_ago)

        et = random.choices(event_types, weights=[60, 15, 5, 5, 5, 5], k=1)[0]
        amount = round(random.lognormvariate(4, 1.5), 2) if et == "transaction" else 0
        amount = min(amount, 15000)
        country = random.choice(["US", "US", "US", "US", "GB", "CA", "DE", "RO", "NG"])
        is_intl = country not in ["US"]
        risk = round(random.uniform(0, 0.3), 2) if ue.risk_score < 0.5 else round(random.uniform(0.4, 0.95), 2)

        ev = Event(
            id=uuid.uuid5(uuid.NAMESPACE_DNS, f"event_{i}"),
            org_id=org_id,
            event_type=et,
            source="seed",
            entity_id=ue.id,
            data={
                "amount": amount,
                "currency": "USD",
                "country": country,
                "is_international": is_intl,
                "device_id": str(de.id),
                "ip": ie.external_id,
                "new_device": random.random() > 0.8,
                "merchant": me.display_name
            },
            risk_score=risk,
            processed=True,
            occurred_at=occurred
        )
        db.add(ev)
        events.append(ev)

        if et == "transaction":
            txn = Transaction(
                id=uuid.uuid5(uuid.NAMESPACE_DNS, f"txn_{i}"),
                org_id=org_id,
                event_id=ev.id,
                transaction_ref=f"TXN-{100000 + i}",
                amount=amount,
                currency="USD",
                status=random.choice(["completed", "completed", "completed", "declined", "disputed"]),
                merchant_entity_id=me.id,
                user_entity_id=ue.id,
                card_entity_id=ce.id,
                ip_entity_id=ie.id,
                device_entity_id=de.id,
                merchant_category=me.metadata_.get("category", "other"),
                country=country,
                city=random.choice(["New York", "San Francisco", "Chicago", "London", "Toronto"]),
                is_international=is_intl,
                risk_score=risk,
                risk_signals=[{"type": "amount", "value": amount}] if amount > 1000 else [],
                occurred_at=occurred
            )
            db.add(txn)
            transactions.append(txn)

    db.flush()
    print(f"  Created {len(events)} events, {len(transactions)} transactions")

    # ================================================================
    # RULES
    # ================================================================
    from models.database import Rule
    admin_id = platform_users[0].id
    engineer_id = platform_users[4].id

    rules_data = [
        ("High Value Transaction", "threshold", {"field": "amount", "operator": ">", "threshold": 5000},
         "high", "payment_fraud", True),
        ("Velocity: 5+ txns in 1 hour", "velocity", {"window_hours": 1, "max_count": 5},
         "medium", "payment_fraud", True),
        ("International High Value", "threshold", {"field": "amount", "operator": ">", "threshold": 2000, "additional": {"is_international": True}},
         "high", "payment_fraud", True),
        ("Known Bad IPs", "blacklist", {"field": "ip", "values": [ip_entities[100].external_id, ip_entities[101].external_id, ip_entities[110].external_id]},
         "critical", "account_takeover", True),
        ("Rapid Password Resets", "velocity", {"window_hours": 24, "max_count": 3, "event_type": "password_reset"},
         "high", "account_takeover", True),
        ("New Device + High Amount", "composite", {"rules": [
            {"type": "threshold", "condition": {"field": "amount", "operator": ">", "threshold": 1000}},
            {"type": "pattern", "condition": {"patterns": {"new_device": "true"}}}
        ]}, "high", "payment_fraud", True),
        ("Promo Abuse: Device Reuse", "pattern", {"patterns": {"shared_device_accounts": "3+"}},
         "medium", "promo_abuse", True),
        ("Bot Detection: High Velocity", "velocity", {"window_hours": 1, "max_count": 50},
         "critical", "bot_attack", True),
        ("Chargeback Risk: Category", "pattern", {"patterns": {"merchant_category": "crypto|gift_cards"}},
         "medium", "chargeback_risk", True),
        ("Suspicious Country Combo", "pattern", {"patterns": {"country": "NG|RO|BY"}},
         "medium", "payment_fraud", False),
    ]

    rule_objects = []
    for name, rtype, condition, severity, alert_type, enabled in rules_data:
        r = Rule(
            org_id=org_id,
            name=name, rule_type=rtype, condition_json=condition,
            severity=severity, alert_type=alert_type, enabled=enabled,
            description=f"Detection rule: {name}",
            created_by=engineer_id
        )
        db.add(r)
        rule_objects.append(r)

    db.flush()
    print(f"  Created {len(rule_objects)} rules")

    # ================================================================
    # FEATURES
    # ================================================================
    from models.database import Feature

    features_data = [
        ("txn_count_1h", "count", {"entity_type": "user", "event_type": "transaction", "window_hours": 1}),
        ("txn_count_24h", "count", {"entity_type": "user", "event_type": "transaction", "window_hours": 24}),
        ("txn_sum_24h", "aggregation", {"entity_type": "user", "field": "amount", "aggregation": "sum", "window_hours": 24}),
        ("unique_ips_24h", "count", {"entity_type": "user", "target": "ip", "aggregation": "count_distinct", "window_hours": 24}),
        ("device_reuse_count", "count", {"entity_type": "device", "target": "user", "aggregation": "count_distinct", "window_days": 30}),
        ("avg_txn_amount_7d", "aggregation", {"entity_type": "user", "field": "amount", "aggregation": "avg", "window_days": 7}),
        ("international_ratio_30d", "ratio", {"entity_type": "user", "numerator": "international_txn_count", "denominator": "total_txn_count", "window_days": 30}),
        ("failed_login_count_1h", "count", {"entity_type": "user", "event_type": "login_attempt", "filter": {"success": False}, "window_hours": 1}),
    ]

    for name, ftype, definition in features_data:
        f = Feature(
            org_id=org_id,
            name=name, feature_type=ftype, definition_json=definition,
            description=f"Feature: {name}",
            enabled=True, created_by=engineer_id
        )
        db.add(f)

    db.flush()
    print(f"  Created {len(features_data)} features")

    # ================================================================
    # ALERTS (25)
    # ================================================================
    from models.database import Alert

    alert_configs = [
        ("account_takeover", "critical", "Suspicious login from new device and location", user_entities[50]),
        ("account_takeover", "high", "Multiple password resets in 24 hours", user_entities[51]),
        ("payment_fraud", "critical", "Transaction $8,500 exceeds threshold", user_entities[46]),
        ("payment_fraud", "high", "5 transactions in 30 minutes", user_entities[47]),
        ("payment_fraud", "high", "International transaction from known bad IP", user_entities[48]),
        ("payment_fraud", "medium", "Unusual merchant category for user", user_entities[49]),
        ("promo_abuse", "medium", "3 accounts sharing device fingerprint", user_entities[52]),
        ("promo_abuse", "medium", "Rapid promo code usage pattern", user_entities[53]),
        ("bot_attack", "critical", "50+ requests in 1 minute from single IP", user_entities[54]),
        ("chargeback_risk", "high", "Transaction at high-risk merchant category", user_entities[55]),
        ("payment_fraud", "medium", "Transaction amount 3x user average", user_entities[45]),
        ("account_takeover", "high", "Email change followed by card addition", user_entities[56]),
        ("payment_fraud", "critical", "Card testing pattern detected", user_entities[57]),
        ("payment_fraud", "high", "Multiple declines followed by approval", user_entities[58]),
        ("bot_attack", "high", "Automated signup pattern detected", user_entities[59]),
        ("payment_fraud", "medium", "First international transaction", user_entities[40]),
        ("chargeback_risk", "medium", "Previous chargeback on same card", user_entities[41]),
        ("account_takeover", "medium", "Login from previously unseen country", user_entities[42]),
        ("promo_abuse", "low", "Multiple referral signups from same IP", user_entities[43]),
        ("payment_fraud", "low", "Slightly above average transaction", user_entities[44]),
        ("payment_fraud", "high", "Rapid succession purchases at different merchants", user_entities[46]),
        ("account_takeover", "critical", "SIM swap indicator detected", user_entities[50]),
        ("bot_attack", "medium", "Headless browser fingerprint detected", user_entities[54]),
        ("chargeback_risk", "high", "Friendly fraud pattern match", user_entities[55]),
        ("payment_fraud", "medium", "Geo-velocity impossible travel", user_entities[48]),
    ]

    alert_objects = []
    for i, (atype, severity, title, entity) in enumerate(alert_configs):
        status = "new"
        if i < 5:
            status = "investigating"
        elif i < 10:
            status = "acknowledged"
        elif i < 15:
            status = "new"
        elif i < 20:
            status = "resolved"
        else:
            status = "new"

        a = Alert(
            id=uuid.uuid5(uuid.NAMESPACE_DNS, f"alert_{i}"),
            org_id=org_id,
            alert_type=atype,
            severity=severity,
            title=title,
            description=f"Automated detection: {title}. Entity: {entity.display_name} ({entity.external_id})",
            entity_id=entity.id,
            rule_id=rule_objects[i % len(rule_objects)].id if i < len(rule_objects) else None,
            model_score=round(random.uniform(0.6, 0.99), 3),
            status=status,
            assigned_to=platform_users[1 + (i % 3)].id if status in ("investigating", "acknowledged") else None,
            data={"entity_name": entity.display_name, "risk_score": entity.risk_score},
            created_at=datetime.utcnow() - timedelta(hours=random.randint(0, 120)),
            resolved_at=datetime.utcnow() - timedelta(hours=random.randint(0, 24)) if status == "resolved" else None
        )
        db.add(a)
        alert_objects.append(a)

    db.flush()
    print(f"  Created {len(alert_objects)} alerts")

    # ================================================================
    # CASES (10)
    # ================================================================
    from models.database import Case, Evidence, CaseComment, CaseDecision, Narrative

    case_configs = [
        ("ATO Ring Investigation", "critical", "investigating", [0, 1, 21], [50, 51], None),
        ("High-Value Payment Fraud", "critical", "investigating", [2, 3], [46, 47], None),
        ("Cross-Border Fraud Network", "high", "pending_review", [4, 5], [48, 49], None),
        ("Promo Abuse Cluster", "medium", "investigating", [6, 7], [52, 53], None),
        ("Bot Attack Mitigation", "high", "resolved", [8, 22], [54], "block"),
        ("Chargeback Pattern", "medium", "resolved", [9, 23], [55], "deny"),
        ("Card Testing Detection", "critical", "escalated", [12, 13], [57, 58], "escalate"),
        ("New User Fraud Ring", "high", "resolved", [10, 11], [45, 56], "approve"),
        ("Friendly Fraud Case", "medium", "closed", [16, 23], [41, 55], "deny"),
        ("Geographic Anomaly", "low", "new", [17, 24], [42, 48], None),
    ]

    case_objects = []
    case_alert_links = []
    for i, (title, priority, status, alert_idxs, entity_idxs, decision) in enumerate(case_configs):
        c_alert_ids = [alert_objects[idx].id for idx in alert_idxs if idx < len(alert_objects)]
        c_entity_ids = [user_entities[idx].id for idx in entity_idxs if idx < len(user_entities)]

        sla_hours = 24 if priority in ["critical", "high"] else 72
        sla = datetime.utcnow() + timedelta(hours=sla_hours) if status not in ("resolved", "closed") else None
        if status in ("resolved", "closed") and i == 8:
            sla = None

        # Make one case breach SLA
        if i == 3:
            sla = datetime.utcnow() - timedelta(hours=5)

        case = Case(
            id=uuid.uuid5(uuid.NAMESPACE_DNS, f"case_{i}"),
            org_id=org_id,
            case_number=f"CASE-{i+1:05d}",
            title=title,
            description=f"Investigation into {title.lower()}. Multiple risk indicators detected.",
            status=status,
            priority=priority,
            decision=decision,
            assigned_to=platform_users[1 + (i % 3)].id,
            alert_ids=c_alert_ids,
            entity_ids=c_entity_ids,
            sla_deadline=sla,
            tags=["fraud", priority] + ([decision] if decision else []),
            resolved_at=datetime.utcnow() - timedelta(hours=random.randint(1, 48)) if status in ("resolved", "closed") else None,
            created_at=datetime.utcnow() - timedelta(hours=random.randint(24, 168))
        )
        db.add(case)
        case_objects.append(case)
        case_alert_links.append((case.id, alert_idxs))

    # Flush case rows first so alert foreign-key updates always reference
    # existing cases in Postgres, including stricter hosted environments.
    db.flush()

    # Link alerts to cases after cases exist in the database.
    for case_id, alert_idxs in case_alert_links:
        for aidx in alert_idxs:
            if aidx < len(alert_objects):
                alert_objects[aidx].case_id = case_id

    db.flush()

    # Add evidence to cases
    for case in case_objects:
        for j in range(random.randint(3, 8)):
            ev = Evidence(
                org_id=org_id,
                case_id=case.id,
                evidence_type=random.choice(["transaction", "signal", "entity_link", "enrichment"]),
                title=f"Evidence item {j+1} for {case.case_number}",
                content=f"Automated evidence collection for investigation. Risk indicators found during analysis of entity connections and transaction patterns.",
                source=random.choice(["alert_system", "entity_store", "transaction_store", "enrichment_api"]),
                entity_id=case.entity_ids[0] if case.entity_ids else None,
                metadata_={"auto_collected": True, "relevance_score": round(random.uniform(0.5, 1.0), 2)}
            )
            db.add(ev)

    # Add comments to some cases
    for i, case in enumerate(case_objects[:7]):
        for j in range(random.randint(1, 4)):
            commenter = platform_users[1 + (j % 3)]
            comment = CaseComment(
                org_id=org_id,
                case_id=case.id,
                user_id=commenter.id,
                content=random.choice([
                    "Reviewed the entity connections. Found shared device fingerprint across 3 accounts.",
                    "Transaction pattern confirms suspicious velocity. Recommending escalation.",
                    "IP geolocation shows impossible travel - 2 countries within 30 minutes.",
                    "Device fingerprint matches known fraud ring from previous investigation.",
                    "Enrichment data shows email is from a disposable provider.",
                    "Contacted the user for verification. Awaiting response.",
                    "Similar pattern observed in CASE-00003. Might be related.",
                    "Risk score trending upward over last 48 hours.",
                ]),
                created_at=datetime.utcnow() - timedelta(hours=random.randint(1, 72))
            )
            db.add(comment)

    # Add decisions to resolved cases
    for case in case_objects:
        if case.decision:
            dec = CaseDecision(
                org_id=org_id,
                case_id=case.id,
                decision=case.decision,
                rationale=f"Based on evidence review, the decision is to {case.decision} this case. Risk indicators {'confirmed' if case.decision in ('deny', 'block') else 'assessed as manageable'}.",
                user_id=case.assigned_to
            )
            db.add(dec)

    # Add narrative to some cases
    for case in case_objects[:5]:
        nar = Narrative(
            org_id=org_id,
            case_id=case.id,
            content=f"# Investigation Narrative: {case.title}\n\n## Summary\nThis case involves {case.priority}-priority risk indicators. Investigation revealed suspicious patterns consistent with the alert type.\n\n## Evidence\nMultiple evidence items were collected and analyzed. Key findings include entity connection anomalies and transaction pattern deviations.\n\n## Risk Assessment\nOverall risk level: {case.priority.upper()}\n\n## Recommended Actions\n1. Continue monitoring linked entities\n2. Implement suggested detection rules\n3. Review similar historical cases",
            citations=[{"id": f"EVD-{j+1:03d}", "title": f"Evidence {j+1}", "type": "signal"} for j in range(3)],
            model_used="local/rule-based",
            prompt_version="v1",
            generation_time_ms=random.randint(50, 200),
            created_by=case.assigned_to
        )
        db.add(nar)

    db.flush()
    print(f"  Created {len(case_objects)} cases with evidence, comments, and decisions")

    # ================================================================
    # DEPLOYMENTS
    # ================================================================
    from models.database import Deployment

    for i, rule in enumerate(rule_objects[:5]):
        dep = Deployment(
            org_id=org_id,
            deployment_type="rule",
            artifact_id=rule.id,
            artifact_name=rule.name,
            action="enable",
            config_snapshot=rule.condition_json,
            deployed_by=engineer_id,
            notes=f"Initial deployment of rule: {rule.name}",
            created_at=datetime.utcnow() - timedelta(days=random.randint(1, 30))
        )
        db.add(dep)

    print("  Created deployments")

    # ================================================================
    # NOTIFICATIONS
    # ================================================================
    from models.database import Notification

    for user in platform_users[:4]:
        for _ in range(random.randint(3, 8)):
            n = Notification(
                org_id=org_id,
                user_id=user.id,
                notification_type=random.choice(["alert_assigned", "case_updated", "sla_warning", "comment_mention"]),
                title=random.choice([
                    "New critical alert assigned to you",
                    "Case CASE-00001 status updated",
                    "SLA breach warning: CASE-00004",
                    "You were mentioned in a comment",
                    "New evidence collected for your case",
                ]),
                message="Check the case workspace for details.",
                read=random.random() > 0.5,
                data={},
                created_at=datetime.utcnow() - timedelta(hours=random.randint(0, 72))
            )
            db.add(n)

    # ================================================================
    # AUDIT LOGS
    # ================================================================
    from models.database import AuditLog

    actions = ["login", "view_case", "update_alert", "create_case", "generate_narrative",
               "deploy_rule", "collect_evidence", "add_comment", "case_decision"]
    for _ in range(50):
        user = random.choice(platform_users[:4])
        al = AuditLog(
            org_id=org_id,
            user_id=user.id,
            user_email=user.email,
            action=random.choice(actions),
            resource_type=random.choice(["case", "alert", "rule", "entity"]),
            resource_id=str(uuid.uuid4()),
            details={},
            created_at=datetime.utcnow() - timedelta(hours=random.randint(0, 168))
        )
        db.add(al)

    db.commit()
    print("Seed data complete!")
    print(f"\nLogin credentials:")
    print(f"  Admin:    admin@riskpulse.io / riskpulse123")
    print(f"  Analyst:  sarah.chen@riskpulse.io / riskpulse123")
    print(f"  Engineer: alex.kumar@riskpulse.io / riskpulse123")
    print(f"  Viewer:   viewer@riskpulse.io / riskpulse123")
    db.close()


if __name__ == "__main__":
    seed()
