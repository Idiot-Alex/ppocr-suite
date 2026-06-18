from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "PP-OCRv6 API"
    app_env: str = "dev"
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    ocr_lang: str = "ch"
    ocr_model_size: str = "tiny"
    ocr_use_gpu: bool = False
    ocr_preload_on_startup: bool = True
    ocr_include_raw_by_default: bool = False

    max_upload_size_mb: int = 10
    api_key: str = "change-me"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
