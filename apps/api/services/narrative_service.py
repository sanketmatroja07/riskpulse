"""
Narrative Generation Service: LLM-powered case narratives with citations.
Supports OpenAI, Anthropic, and local rule-based fallback.
"""
import time
from datetime import datetime
from typing import Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.database import Case, Evidence, Narrative, PromptTemplate, Entity, Alert
from models.schemas import NarrativeResponse
from config import get_settings
import structlog
import re

logger = structlog.get_logger()
settings = get_settings()

# Safety filters
BLOCKED_PATTERNS = [
    r"how to commit fraud",
    r"bypass detection",
    r"evade security",
    r"steal identity",
    r"launder money",
    r"social security number",
    r"credit card number \d{4}",
    r"password is",
    r"api[_\s]?key",
    r"secret[_\s]?key",
]


def apply_safety_filter(text: str) -> tuple[str, bool]:
    """Apply safety filters to generated text. Returns (filtered_text, was_filtered)."""
    filtered = False
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            text = re.sub(pattern, "[REDACTED]", text, flags=re.IGNORECASE)
            filtered = True

    # Mask potential PII
    text = re.sub(r"\b\d{3}-\d{2}-\d{4}\b", "[SSN-REDACTED]", text)
    text = re.sub(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b", "[CARD-REDACTED]", text)

    return text, filtered


async def generate_narrative(db: AsyncSession, case_id: UUID, user_id: UUID) -> Narrative:
    """Generate a case narrative using configured LLM provider."""
    start_time = time.time()

    # Get case
    case_result = await db.execute(select(Case).where(Case.id == case_id))
    case = case_result.scalar_one_or_none()
    if not case:
        raise ValueError("Case not found")

    # Get evidence
    evidence_result = await db.execute(
        select(Evidence).where(Evidence.case_id == case_id).order_by(Evidence.created_at)
    )
    evidence_items = evidence_result.scalars().all()

    # Get related alerts
    alert_type = "unknown"
    if case.alert_ids:
        alert_result = await db.execute(select(Alert).where(Alert.id.in_(case.alert_ids)).limit(1))
        alert = alert_result.scalar_one_or_none()
        if alert:
            alert_type = alert.alert_type

    # Build evidence summary with citations
    evidence_summary = []
    citations = []
    for i, ev in enumerate(evidence_items):
        evd_id = f"EVD-{i+1:03d}"
        citations.append({
            "id": evd_id,
            "evidence_id": str(ev.id),
            "title": ev.title,
            "type": ev.evidence_type,
            "timestamp": ev.collected_at.isoformat() if ev.collected_at else None
        })
        evidence_summary.append(f"[{evd_id}] {ev.title}: {ev.content[:200] if ev.content else 'N/A'}")

    # Get prompt template
    template_result = await db.execute(
        select(PromptTemplate).where(
            PromptTemplate.name == "case_narrative",
            PromptTemplate.is_active == True
        ).order_by(PromptTemplate.version.desc()).limit(1)
    )
    template = template_result.scalar_one_or_none()

    # Build entity graph summary
    entity_graph = "No entity connections available"
    if case.entity_ids:
        entities_result = await db.execute(select(Entity).where(Entity.id.in_(case.entity_ids)))
        entities = entities_result.scalars().all()
        entity_graph = "\n".join([
            f"- {e.entity_type}: {e.display_name or e.external_id} (risk: {e.risk_score:.2f})"
            for e in entities
        ])

    # Choose provider
    provider = settings.LLM_PROVIDER.lower()
    prompt_version = "v1"

    if provider == "openai" and settings.OPENAI_API_KEY:
        content = await _generate_openai(
            template, case, alert_type, evidence_summary, entity_graph, citations
        )
        model_used = "openai/gpt-4"
    elif provider == "anthropic" and settings.ANTHROPIC_API_KEY:
        content = await _generate_anthropic(
            template, case, alert_type, evidence_summary, entity_graph, citations
        )
        model_used = "anthropic/claude-3"
    else:
        content = _generate_local(case, alert_type, evidence_items, citations, entity_graph)
        model_used = "local/rule-based"

    # Apply safety filter
    content, was_filtered = apply_safety_filter(content)

    elapsed_ms = int((time.time() - start_time) * 1000)

    narrative = Narrative(
        org_id=case.org_id,
        case_id=case_id,
        content=content,
        citations=citations,
        model_used=model_used,
        prompt_version=prompt_version,
        safety_filtered=was_filtered,
        generation_time_ms=elapsed_ms,
        created_by=user_id
    )
    db.add(narrative)
    await db.commit()
    await db.refresh(narrative)

    logger.info("narrative_generated", case_id=str(case_id), model=model_used, time_ms=elapsed_ms)
    return narrative


async def _generate_openai(template, case, alert_type, evidence_summary, entity_graph, citations) -> str:
    """Generate narrative using OpenAI."""
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        prompt = _build_prompt(template, case, alert_type, evidence_summary, entity_graph)

        response = await client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a fraud investigation analyst. Generate factual, evidence-based narratives. Never provide instructions for committing fraud."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=2000
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error("openai_error", error=str(e))
        return _generate_local(case, alert_type, [], citations, entity_graph)


async def _generate_anthropic(template, case, alert_type, evidence_summary, entity_graph, citations) -> str:
    """Generate narrative using Anthropic."""
    try:
        from anthropic import AsyncAnthropic
        client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

        prompt = _build_prompt(template, case, alert_type, evidence_summary, entity_graph)

        response = await client.messages.create(
            model="claude-3-sonnet-20240229",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
            system="You are a fraud investigation analyst. Generate factual, evidence-based narratives. Never provide instructions for committing fraud."
        )
        return response.content[0].text
    except Exception as e:
        logger.error("anthropic_error", error=str(e))
        return _generate_local(case, alert_type, [], citations, entity_graph)


def _build_prompt(template, case, alert_type, evidence_summary, entity_graph) -> str:
    """Build the prompt from template."""
    if template:
        prompt = template.template
        prompt = prompt.replace("{case_title}", case.title)
        prompt = prompt.replace("{priority}", case.priority)
        prompt = prompt.replace("{alert_type}", alert_type)
        prompt = prompt.replace("{evidence_summary}", "\n".join(evidence_summary))
        prompt = prompt.replace("{entity_graph}", entity_graph)
        prompt = prompt.replace("{transaction_history}", "See evidence items above.")
        return prompt

    return f"""Analyze this investigation case and generate a narrative:
Case: {case.title}
Priority: {case.priority}
Alert Type: {alert_type}

Evidence:
{chr(10).join(evidence_summary)}

Entities:
{entity_graph}

Generate a structured narrative with risk assessment and next steps. Reference evidence by ID."""


def _generate_local(case, alert_type, evidence_items, citations, entity_graph) -> str:
    """Local rule-based narrative generator (no API required)."""

    severity_text = {
        "critical": "Critical risk level detected",
        "high": "Elevated risk indicators identified",
        "medium": "Moderate risk signals observed",
        "low": "Low-level anomalies noted"
    }

    alert_descriptions = {
        "account_takeover": "Account takeover indicators were detected, including unusual login patterns, device changes, or credential modification attempts.",
        "payment_fraud": "Suspicious payment activity was identified, with transaction patterns deviating from established baselines.",
        "promo_abuse": "Promotional abuse patterns were detected, including systematic exploitation of promotional offers.",
        "bot_attack": "Automated/bot activity indicators were identified, suggesting non-human interaction patterns.",
        "chargeback_risk": "Chargeback risk indicators were detected based on transaction patterns and merchant category analysis."
    }

    # Build narrative sections
    sections = []

    # Header
    sections.append(f"# Investigation Narrative: {case.title}")
    sections.append(f"**Case Number:** {case.case_number}")
    sections.append(f"**Priority:** {case.priority.upper()}")
    sections.append(f"**Generated:** {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
    sections.append("")

    # Executive Summary
    sections.append("## Executive Summary")
    sections.append(severity_text.get(case.priority, "Risk indicators identified") + ".")
    sections.append(alert_descriptions.get(alert_type, "Suspicious activity patterns were identified requiring investigation."))
    sections.append("")

    # Evidence Analysis
    sections.append("## Evidence Analysis")
    if citations:
        for c in citations[:10]:
            sections.append(f"- **[{c['id']}]** {c['title']} (Type: {c['type']}, Collected: {c.get('timestamp', 'N/A')})")
    else:
        sections.append("No evidence items collected yet. Use 'Collect Evidence' to gather signals.")
    sections.append("")

    # Entity Connections
    sections.append("## Entity Connections")
    sections.append(entity_graph)
    sections.append("")

    # Risk Assessment
    risk_level = case.priority
    sections.append("## Risk Assessment")
    sections.append(f"**Overall Risk Level:** {risk_level.upper()}")
    sections.append("")

    risk_factors = []
    if alert_type == "account_takeover":
        risk_factors = [
            "Unusual device or location change",
            "Credential modification in rapid succession",
            "Access pattern deviation from baseline"
        ]
    elif alert_type == "payment_fraud":
        risk_factors = [
            "Transaction amount exceeds normal pattern",
            "Unusual merchant category for this user",
            "Geographic anomaly in transaction origin"
        ]
    elif alert_type == "promo_abuse":
        risk_factors = [
            "Multiple accounts with shared device fingerprint",
            "Systematic promo code application pattern",
            "New account creation velocity anomaly"
        ]
    else:
        risk_factors = [
            "Pattern deviation from established baseline",
            "Multiple risk signals converging on same entity",
            "Temporal correlation with known attack patterns"
        ]

    for rf in risk_factors:
        sections.append(f"- {rf}")
    sections.append("")

    # Recommended Actions
    sections.append("## Recommended Next Steps")
    actions = [
        "Review all linked entity connections for additional exposure",
        "Verify identity through out-of-band communication",
        "Check for similar patterns across related entities",
        "Consider implementing velocity-based rule for this pattern",
        "Document findings and escalate if risk confirms"
    ]
    for i, action in enumerate(actions, 1):
        sections.append(f"{i}. {action}")

    return "\n".join(sections)
