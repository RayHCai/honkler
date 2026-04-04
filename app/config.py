from pathlib import Path

from pydantic_settings import BaseSettings

# Resolve project root: this file is at <project>/app/config.py
_APP_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _APP_DIR.parent


class Settings(BaseSettings):
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    base_url: str = "http://localhost:8000"

    # Gemini
    gemini_api_key: str = ""

    # ElevenLabs
    elevenlabs_api_key: str = ""
    elevenlabs_agent_id: str = ""
    elevenlabs_agent_phone_number_id: str = ""

    # Twilio
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""

    # Express Backend
    express_backend_url: str = "http://localhost:3001"

    # Shared upload directory (same as Express UPLOAD_DIR)
    upload_dir: str = str(_PROJECT_ROOT / "api" / "uploads")

    # Solana x402
    solana_facilitator_private_key: str = ""
    solana_network: str = "solana-devnet"
    solana_pay_to_address: str = ""

    model_config = {"env_file": ".env", "env_prefix": "HONKLER_"}


settings = Settings()
