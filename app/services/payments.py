import logging

from app.config import Settings
from app.schemas.calls import CallOutcome
from app.schemas.payments import SettlementResult

logger = logging.getLogger("app.services.payments")

# Fee: 10% of monthly savings, capped at $20
FEE_PERCENTAGE = 0.10
FEE_CAP = 20.0


class PaymentService:
    def __init__(self, settings: Settings):
        self.network = settings.solana_network
        self.pay_to = settings.solana_pay_to_address
        self.private_key = settings.solana_facilitator_private_key

    def _calculate_fee(self, monthly_savings: float) -> float:
        fee = monthly_savings * FEE_PERCENTAGE
        return min(fee, FEE_CAP)

    async def settle_call_payment(
        self,
        call_outcome: CallOutcome,
        wallet_address: str,
    ) -> SettlementResult:
        logger.info("Payment settlement for call %s (success=%s, savings=$%s, wallet=%s)",
                     call_outcome.call_id, call_outcome.success, call_outcome.savings_achieved, wallet_address)

        if not call_outcome.success or not call_outcome.savings_achieved:
            logger.info("  No savings achieved — skipping payment")
            return SettlementResult(charged=False, reason="No savings achieved")

        fee = self._calculate_fee(call_outcome.savings_achieved)
        logger.info("  Fee calculation: $%.2f savings × %.0f%% = $%.2f (cap $%.2f)",
                     call_outcome.savings_achieved, FEE_PERCENTAGE * 100, fee, FEE_CAP)
        logger.info("  Network: %s, Pay to: %s", self.network, self.pay_to)

        # TODO: Integrate x402-solana SDK once available
        # For now, log the intent and return a placeholder
        # Real implementation:
        #   from x402_solana.schemes.exact_svm.facilitator import settle_payment, verify_payment
        #   from x402_solana.shared.svm.wallet import create_signer_from_bytes
        #   signer = create_signer_from_bytes(bytes.fromhex(self.private_key))
        #   ... verify and settle ...

        logger.info("  Settlement result: charged=$%.2f (placeholder)", fee)
        return SettlementResult(
            charged=True,
            transaction_id="placeholder_tx_id",
            amount=fee,
        )
