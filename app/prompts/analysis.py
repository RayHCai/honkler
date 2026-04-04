POST_CALL_PROMPT = """Analyze this customer service call transcript and determine the outcome.

ORIGINAL NEGOTIATION PLAN:
{original_plan}

CALL TRANSCRIPT:
{transcript}

Determine:
1. Was the negotiation successful? (Did they agree to a lower price?)
2. What was the agreed-upon price (if any)?
3. Summarize what was agreed upon
4. List any next steps mentioned (reference numbers, callback dates, confirmation emails)
5. Calculate total savings achieved (monthly and annual)
6. Rate your confidence in this analysis from 0.0 to 1.0

Return as JSON matching the CallOutcome schema."""
