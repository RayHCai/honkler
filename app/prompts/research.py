BILL_EXTRACTION_PROMPT = """Analyze this bill/receipt document and extract the following information.
Return structured JSON with:
- company_name: The company or provider name on the bill
- service_type: The type of service (e.g. Internet, Cable, Phone, Electric, etc.)
- current_price: The total monthly charge as a number
- customer_service_phone: The customer service or support phone number from the bill. \
Look carefully for numbers labeled "Call Us", "Contact Us", "Customer Service", "Support", \
"Questions about your bill?", or similar. Prefer toll-free numbers (1-800, 1-888, etc.). \
Return in E.164 format (e.g. +18001234567) if possible.
- account_number: The account number (redact all but last 4 digits)
- line_items: A list of individual charges/line items as strings (e.g. "Internet Service: $79.99")
- contract_end_date: The contract end date if visible, as a string

Be precise with the price — use the total monthly amount, not one-time charges."""

BILL_ANALYSIS_PROMPT = """Analyze this bill/receipt document for {company} ({service}).
Extract:
- Current monthly charge and any line items
- Contract terms, end date if visible
- Any fees or surcharges
- Account number or reference (redact last 4 digits only)
Return a structured summary."""

COMPETITOR_RESEARCH_PROMPT = """Research the current market for {service} service
similar to what {company} provides at ${current_price}/month.

Find:
1. The customer service or retention department phone number for {company} (REQUIRED — search for "{company} customer service phone number")
2. Competing providers and their current prices for equivalent service
3. Any current promotions or deals from {company} itself
4. Known retention offers from {company}
5. Recent price changes or announcements

Bill details: {bill_details}

Be specific with prices, URLs, and dates. Cite your sources."""

STRATEGY_PROMPT = """Based on the research below, build a negotiation strategy
for reducing the price of {service} from {company}, currently at ${current_price}/month.

Research findings:
{research}

Bill details:
{bill_details}

Additional context from user:
{additional_context}

Create a complete negotiation plan with:
- customer_service_phone: The company's customer service or retention phone number (REQUIRED — must be a valid phone number in E.164 format like +18001234567). \
If a phone number from the bill is provided below, you MUST use that number — it takes priority over any number found via web research.
- A realistic target price (aggressive but achievable)
- A floor price (absolute minimum acceptable)
- Ordered talking points (strongest first)
- Fallback positions if primary arguments fail
- Any detected promotions to reference
- Intelligence on the company's retention department behavior

Return as JSON matching the NegotiationPlan schema."""
